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


# ── 5. Cancel Subscription ───────────────────────────────────────
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

    # ── checkout.session.completed ─────────────────────────────
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        subscription_id = session.get("subscription")
        customer_id = session.get("customer")

        # Look up user by stripe customer ID
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if not user:
            # Fallback: look up by metadata
            notepeel_id = session.get("metadata", {}).get("notepeel_user_id")
            if notepeel_id:
                user = db.query(User).filter(User.id == int(notepeel_id)).first()

        if user and subscription_id:
            # Fetch the subscription to find which price they bought
            sub = stripe.Subscription.retrieve(subscription_id)
            price_id = sub["items"]["data"][0]["price"]["id"]
            plan = PRICE_TO_PLAN.get(price_id, "pro")

            user.stripe_subscription_id = subscription_id
            user.subscription = plan
            db.commit()
            print(f"✅ User {user.id} upgraded to {plan}")

    # ── customer.subscription.updated (plan change, renewal) ───
    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

        if user:
            price_id = sub["items"]["data"][0]["price"]["id"]
            plan = PRICE_TO_PLAN.get(price_id, user.subscription)

            user.subscription = plan
            user.stripe_subscription_id = sub["id"]
            db.commit()
            print(f"🔄 User {user.id} subscription updated to {plan}")

    # ── customer.subscription.deleted (cancelled / expired) ────
    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

        if user:
            user.subscription = "free"
            user.stripe_subscription_id = None
            db.commit()
            print(f"❌ User {user.id} downgraded to free (subscription ended)")

    return {"status": "ok"}
