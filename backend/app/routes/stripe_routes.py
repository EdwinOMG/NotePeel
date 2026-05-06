"""
Stripe integration routes for NotePeel subscriptions.

Setup checklist:
  1. pip install stripe
  2. Add these to your .env:
       STRIPE_SECRET_KEY=sk_live_...        (or sk_test_... for testing)
       STRIPE_WEBHOOK_SECRET=whsec_...
       STRIPE_PRO_MONTHLY_PRICE_ID=price_...
       STRIPE_PRO_ANNUAL_PRICE_ID=price_...
       STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
       STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_...
       FRONTEND_URL=https://your-frontend.com
  3. In the Stripe Dashboard → Webhooks, create an endpoint pointing at:
       https://your-backend.com/api/stripe/webhook
     and subscribe to these events:
       - checkout.session.completed
       - customer.subscription.updated
       - customer.subscription.deleted
"""

import stripe
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.controllers.auth_controller import get_current_user
from app.models.user import User

router = APIRouter(prefix="/stripe", tags=["stripe"])

settings = get_settings()
stripe.api_key = settings.stripe_secret_key

# ── Map Stripe Price IDs → plan names ────────────────────────────
# This is populated at import time from your env vars.
PRICE_TO_PLAN: dict[str, str] = {}
if settings.stripe_pro_monthly_price_id:
    PRICE_TO_PLAN[settings.stripe_pro_monthly_price_id] = "pro"
if settings.stripe_pro_annual_price_id:
    PRICE_TO_PLAN[settings.stripe_pro_annual_price_id] = "pro"
if settings.stripe_premium_monthly_price_id:
    PRICE_TO_PLAN[settings.stripe_premium_monthly_price_id] = "premium"
if settings.stripe_premium_annual_price_id:
    PRICE_TO_PLAN[settings.stripe_premium_annual_price_id] = "premium"


# ── Helpers ──────────────────────────────────────────────────────

def _resolve_plan_from_subscription(subscription_id: str) -> str:
    """Fetch a subscription from Stripe and resolve which plan it maps to.

    Returns the plan name ("pro" / "premium") or "pro" as a safe fallback
    if the price ID isn't in PRICE_TO_PLAN (the user paid, so they should
    never be left on free).
    """
    sub = stripe.Subscription.retrieve(subscription_id)
    price_id = sub["items"]["data"][0]["price"]["id"]
    return PRICE_TO_PLAN.get(price_id, "pro")


def _find_user_for_webhook(
    db: Session,
    customer_id: str | None,
    metadata: dict | None = None,
) -> User | None:
    """Look up the NotePeel user that corresponds to a Stripe event.

    Strategy:
      1. By stripe_customer_id (set when the checkout session was created).
      2. By notepeel_user_id stored in the session/subscription metadata.
    """
    user = None
    if customer_id:
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

    if not user and metadata:
        notepeel_id = metadata.get("notepeel_user_id")
        if notepeel_id:
            user = db.query(User).filter(User.id == int(notepeel_id)).first()
            # Backfill stripe_customer_id so future events match on attempt 1
            if user and customer_id and not user.stripe_customer_id:
                user.stripe_customer_id = customer_id

    return user


def _get_or_create_stripe_customer(db: Session, user: User) -> str:
    """Return the Stripe customer ID for a user, creating one if needed."""
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        metadata={"notepeel_user_id": str(user.id)},
    )
    user.stripe_customer_id = customer.id
    db.commit()
    return customer.id


# ── 1. Create Checkout Session ────────────────────────────────────
@router.post("/checkout")
def create_checkout_session(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accepts: { "price_id": "price_..." }
    Returns: { "checkout_url": "https://checkout.stripe.com/..." }

    The frontend redirects the browser to checkout_url.
    """
    price_id = body.get("price_id")
    if not price_id or price_id not in PRICE_TO_PLAN:
        raise HTTPException(status_code=400, detail="Invalid price_id")

    customer_id = _get_or_create_stripe_customer(db, current_user)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.frontend_url}?checkout=success",
        cancel_url=f"{settings.frontend_url}?checkout=cancel",
        metadata={"notepeel_user_id": str(current_user.id)},
        # Also tag the subscription itself with the user ID so the
        # customer.subscription.updated webhook can find the user
        # even if stripe_customer_id lookup fails.
        subscription_data={
            "metadata": {"notepeel_user_id": str(current_user.id)},
        },
    )

    return {"checkout_url": session.url}


# ── 2. Customer Portal (manage / cancel from Stripe's UI) ────────
@router.post("/portal")
def create_portal_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns: { "portal_url": "https://billing.stripe.com/..." }

    The Stripe Customer Portal lets users update payment methods,
    view invoices, and cancel their subscription themselves.
    """
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    portal = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=settings.frontend_url,
    )
    return {"portal_url": portal.url}


# ── 3. Change Plan (upgrade / downgrade existing subscription) ──
@router.post("/change-plan")
def change_plan(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Switches an existing subscription to a different price.
    Accepts: { "price_id": "price_..." }
    Returns: { "message": "...", "plan": "pro" | "premium" }

    Uses proration so the customer is credited for unused time on the
    old plan and charged the difference for the new one.
    """
    price_id = body.get("price_id")
    if not price_id or price_id not in PRICE_TO_PLAN:
        raise HTTPException(status_code=400, detail="Invalid price_id")

    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription to change")

    # Retrieve the current subscription to get the item ID
    sub = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
    item_id = sub["items"]["data"][0]["id"]

    # Update the subscription item to the new price (prorated)
    stripe.Subscription.modify(
        current_user.stripe_subscription_id,
        items=[{"id": item_id, "price": price_id}],
        proration_behavior="create_prorations",
    )

    # Update the local DB immediately so the UI reflects the change
    new_plan = PRICE_TO_PLAN[price_id]
    current_user.subscription = new_plan
    db.commit()

    return {"message": f"Plan changed to {new_plan}", "plan": new_plan}


# ── 4. Cancel Subscription ───────────────────────────────────────
@router.post("/cancel")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancels at period end (user keeps access until billing cycle ends).
    """
    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    stripe.Subscription.modify(
        current_user.stripe_subscription_id,
        cancel_at_period_end=True,
    )
    return {"message": "Subscription will cancel at end of billing period"}


# ── 5. Sync Subscription (safety net) ────────────────────────────
@router.post("/sync")
def sync_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Called by the frontend after returning from Stripe Checkout to
    ensure the subscription tier is up to date in the database.

    This acts as a safety net — the webhook is the primary mechanism,
    but if it was delayed or failed this endpoint will catch it.
    """
    if not current_user.stripe_customer_id:
        return {"plan": current_user.subscription, "synced": False}

    try:
        # List active subscriptions for this customer
        subscriptions = stripe.Subscription.list(
            customer=current_user.stripe_customer_id,
            status="active",
            limit=1,
        )

        if subscriptions.data:
            sub = subscriptions.data[0]
            price_id = sub["items"]["data"][0]["price"]["id"]
            plan = PRICE_TO_PLAN.get(price_id, "pro")

            changed = False
            if current_user.subscription != plan:
                current_user.subscription = plan
                changed = True
            if current_user.stripe_subscription_id != sub["id"]:
                current_user.stripe_subscription_id = sub["id"]
                changed = True

            if changed:
                db.commit()
                print(f"🔄 Sync: User {current_user.id} updated to {plan}")

            return {"plan": plan, "synced": changed}
        else:
            # No active subscription — make sure they're on free
            if current_user.subscription != "free":
                current_user.subscription = "free"
                current_user.stripe_subscription_id = None
                db.commit()
                return {"plan": "free", "synced": True}
            return {"plan": "free", "synced": False}

    except Exception as e:
        print(f"⚠️ Sync failed for user {current_user.id}: {e}")
        # Don't crash — just return current state
        return {"plan": current_user.subscription, "synced": False}


# ── 6. Webhook (Stripe → your server) ────────────────────────────
@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe sends events here. This is what actually changes the user's
    plan in your database when they pay, upgrade, downgrade, or cancel.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]

    # ── checkout.session.completed ─────────────────────────────
    if event_type == "checkout.session.completed":
        session_obj = event["data"]["object"]
        subscription_id = session_obj.get("subscription")
        customer_id = session_obj.get("customer")
        metadata = session_obj.get("metadata") or {}

        user = _find_user_for_webhook(db, customer_id, metadata)

        if not user:
            print(f"⚠️ checkout.session.completed: could not find user "
                  f"(customer={customer_id}, metadata={metadata})")
            return {"status": "ok"}

        if not subscription_id:
            print(f"⚠️ checkout.session.completed: no subscription_id in session "
                  f"(user={user.id}, session_mode={session_obj.get('mode')})")
            return {"status": "ok"}

        # Resolve which plan they bought
        try:
            plan = _resolve_plan_from_subscription(subscription_id)
        except Exception as e:
            # The user paid — never leave them on free. Default to pro.
            print(f"⚠️ Could not fetch subscription {subscription_id} "
                  f"for user {user.id}: {e} — defaulting to pro")
            plan = "pro"

        user.stripe_subscription_id = subscription_id
        user.subscription = plan
        db.commit()
        print(f"✅ User {user.id} upgraded to {plan}")

    # ── customer.subscription.updated (plan change, renewal) ───
    elif event_type == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        sub_metadata = sub.get("metadata") or {}

        user = _find_user_for_webhook(db, customer_id, sub_metadata)

        if not user:
            print(f"⚠️ customer.subscription.updated: could not find user "
                  f"(customer={customer_id})")
            return {"status": "ok"}

        price_id = sub["items"]["data"][0]["price"]["id"]
        plan = PRICE_TO_PLAN.get(price_id, user.subscription)

        user.subscription = plan
        user.stripe_subscription_id = sub["id"]
        db.commit()
        print(f"🔄 User {user.id} subscription updated to {plan}")

    # ── customer.subscription.deleted (cancelled / expired) ────
    elif event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")

        user = _find_user_for_webhook(db, customer_id)

        if not user:
            print(f"⚠️ customer.subscription.deleted: could not find user "
                  f"(customer={customer_id})")
            return {"status": "ok"}

        user.subscription = "free"
        user.stripe_subscription_id = None
        db.commit()
        print(f"❌ User {user.id} downgraded to free (subscription ended)")

    return {"status": "ok"}
