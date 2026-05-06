"""
Stripe integration routes for NotePeel subscriptions.

Setup:
  1. pip install stripe
  2. .env variables:
       STRIPE_SECRET_KEY=sk_...
       STRIPE_WEBHOOK_SECRET=whsec_...
       STRIPE_PRO_MONTHLY_PRICE_ID=price_...
       STRIPE_PRO_ANNUAL_PRICE_ID=price_...
       STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
       STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_...
       FRONTEND_URL=https://your-frontend.com
  3. Stripe Dashboard → Webhooks → endpoint:
       https://your-backend.com/api/stripe/webhook
     Events:
       - checkout.session.completed
       - customer.subscription.updated
       - customer.subscription.deleted
       - invoice.payment_failed
"""

import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.controllers.auth_controller import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["stripe"])

settings = get_settings()
stripe.api_key = settings.stripe_secret_key


# ─── Price ID → plan mapping ──────────────────────────────────────
def _build_price_map() -> dict[str, str]:
    """Build a mapping of Stripe price IDs to plan names from env vars."""
    mapping: dict[str, str] = {}
    pairs = [
        (settings.stripe_pro_monthly_price_id, "pro"),
        (settings.stripe_pro_annual_price_id, "pro"),
        (settings.stripe_premium_monthly_price_id, "premium"),
        (settings.stripe_premium_annual_price_id, "premium"),
    ]
    for price_id, plan in pairs:
        if price_id:
            mapping[price_id] = plan
    return mapping


PRICE_TO_PLAN = _build_price_map()


# ─── Request schemas ──────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    price_id: str


class ChangePlanRequest(BaseModel):
    price_id: str


# ─── Helpers ──────────────────────────────────────────────────────
def _resolve_plan_from_subscription(subscription_id: str) -> str:
    """Fetch a Stripe subscription and resolve to a plan name."""
    try:
        sub = stripe.Subscription.retrieve(subscription_id)
        price_id = sub["items"]["data"][0]["price"]["id"]
        return PRICE_TO_PLAN.get(price_id, "free")
    except Exception as e:
        logger.error(f"Failed to resolve plan from subscription {subscription_id}: {e}")
        return "free"


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


def _find_user_by_customer_id(db: Session, customer_id: str) -> Optional[User]:
    """Look up a user by their Stripe customer ID."""
    return db.query(User).filter(User.stripe_customer_id == customer_id).first()


def _find_user_for_webhook(db: Session, customer_id: str, metadata: dict) -> Optional[User]:
    """
    Find user from webhook data. Tries customer_id first, then falls back
    to metadata notepeel_user_id.
    """
    user = _find_user_by_customer_id(db, customer_id)
    if user:
        return user

    # Fallback: look up by user ID stored in metadata
    notepeel_id = metadata.get("notepeel_user_id")
    if notepeel_id:
        user = db.query(User).filter(User.id == int(notepeel_id)).first()
        if user:
            # Backfill the stripe_customer_id so future lookups work
            user.stripe_customer_id = customer_id
            return user

    return None


def _update_user_subscription(db: Session, user: User, plan: str,
                               subscription_id: Optional[str] = None) -> None:
    """Atomically update a user's subscription state and commit."""
    user.subscription = plan
    if subscription_id is not None:
        user.stripe_subscription_id = subscription_id
    elif plan == "free":
        user.stripe_subscription_id = None
    db.commit()
    db.refresh(user)
    logger.info(f"User {user.id} ({user.email}) subscription set to '{plan}' "
                f"(stripe_sub={user.stripe_subscription_id})")


# ─── 1. Create Checkout Session ───────────────────────────────────
@router.post("/checkout")
def create_checkout_session(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout session for a new subscription.
    Returns: { "checkout_url": "https://checkout.stripe.com/..." }
    """
    if body.price_id not in PRICE_TO_PLAN:
        raise HTTPException(status_code=400, detail="Invalid price_id")

    customer_id = _get_or_create_stripe_customer(db, current_user)

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": body.price_id, "quantity": 1}],
            success_url=f"{settings.frontend_url}?checkout=success",
            cancel_url=f"{settings.frontend_url}?checkout=cancel",
            metadata={"notepeel_user_id": str(current_user.id)},
            subscription_data={
                "metadata": {"notepeel_user_id": str(current_user.id)},
            },
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout error for user {current_user.id}: {e}")
        raise HTTPException(status_code=502, detail="Payment provider error. Please try again.")

    return {"checkout_url": session.url}


# ─── 2. Customer Portal ──────────────────────────────────────────
@router.post("/portal")
def create_portal_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Open the Stripe Customer Portal for managing payment methods,
    viewing invoices, and cancelling.
    Returns: { "portal_url": "https://billing.stripe.com/..." }
    """
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    try:
        portal = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{settings.frontend_url}?page=plans",
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe portal error for user {current_user.id}: {e}")
        raise HTTPException(status_code=502, detail="Payment provider error. Please try again.")

    return {"portal_url": portal.url}


# ─── 3. Change Plan (upgrade/downgrade) ──────────────────────────
@router.post("/change-plan")
def change_plan(
    body: ChangePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Switch an existing subscription to a different price with proration.
    Returns: { "message": "...", "plan": "pro" | "premium" }
    """
    if body.price_id not in PRICE_TO_PLAN:
        raise HTTPException(status_code=400, detail="Invalid price_id")

    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription to change")

    try:
        sub = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
        item_id = sub["items"]["data"][0]["id"]

        stripe.Subscription.modify(
            current_user.stripe_subscription_id,
            items=[{"id": item_id, "price": body.price_id}],
            proration_behavior="create_prorations",
        )
    except stripe.error.StripeError as e:
        logger.error(f"Plan change error for user {current_user.id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to change plan. Please try again.")

    new_plan = PRICE_TO_PLAN[body.price_id]
    _update_user_subscription(db, current_user, new_plan)

    return {"message": f"Plan changed to {new_plan}", "plan": new_plan}


# ─── 4. Cancel Subscription ──────────────────────────────────────
@router.post("/cancel")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel at period end (user keeps access until billing cycle ends)."""
    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    try:
        stripe.Subscription.modify(
            current_user.stripe_subscription_id,
            cancel_at_period_end=True,
        )
    except stripe.error.StripeError as e:
        logger.error(f"Cancel error for user {current_user.id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to cancel. Please try again.")

    return {"message": "Subscription will cancel at end of billing period"}


# ─── 5. Sync – poll Stripe for current subscription state ────────
@router.post("/sync")
def sync_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually sync subscription state from Stripe. Useful as a fallback
    when the webhook hasn't fired yet (e.g. right after checkout).
    Returns: { "plan": "free" | "pro" | "premium", "synced": true }
    """
    if not current_user.stripe_customer_id:
        return {"plan": "free", "synced": True}

    try:
        subscriptions = stripe.Subscription.list(
            customer=current_user.stripe_customer_id,
            status="active",
            limit=1,
        )
    except stripe.error.StripeError as e:
        logger.error(f"Sync error for user {current_user.id}: {e}")
        raise HTTPException(status_code=502, detail="Could not sync with payment provider.")

    if subscriptions.data:
        sub = subscriptions.data[0]
        price_id = sub["items"]["data"][0]["price"]["id"]
        plan = PRICE_TO_PLAN.get(price_id, "free")
        _update_user_subscription(db, user=current_user, plan=plan,
                                   subscription_id=sub["id"])
        return {"plan": plan, "synced": True}
    else:
        # No active subscription found
        _update_user_subscription(db, user=current_user, plan="free")
        return {"plan": "free", "synced": True}


# ─── 6. Webhook (Stripe → server) ────────────────────────────────
@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe sends events here. This updates the user's plan in the database
    when they pay, upgrade, downgrade, or cancel.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # ── Verify webhook signature ─────────────────────────────────
    if not settings.stripe_webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET not configured – rejecting webhook")
        raise HTTPException(status_code=500, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        logger.warning("Webhook: invalid payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.warning("Webhook: invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data_object = event["data"]["object"]

    logger.info(f"Webhook received: {event_type} (id={event.get('id', '?')})")

    # ── checkout.session.completed ────────────────────────────────
    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, data_object)

    # ── customer.subscription.updated ─────────────────────────────
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(db, data_object)

    # ── customer.subscription.deleted ─────────────────────────────
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(db, data_object)

    # ── invoice.payment_failed ────────────────────────────────────
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(db, data_object)

    return {"status": "ok"}


# ─── Webhook handlers ────────────────────────────────────────────
def _handle_checkout_completed(db: Session, session: dict) -> None:
    """After successful checkout, activate the user's subscription."""
    subscription_id = session.get("subscription")
    customer_id = session.get("customer")
    metadata = session.get("metadata", {})

    if not subscription_id or not customer_id:
        logger.warning("checkout.session.completed missing subscription or customer")
        return

    user = _find_user_for_webhook(db, customer_id, metadata)
    if not user:
        logger.error(
            f"checkout.session.completed: no user found for "
            f"customer={customer_id}, metadata={metadata}"
        )
        return

    plan = _resolve_plan_from_subscription(subscription_id)
    _update_user_subscription(db, user, plan, subscription_id=subscription_id)
    logger.info(f"✅ Checkout complete: user {user.id} → {plan}")


def _handle_subscription_updated(db: Session, sub: dict) -> None:
    """Handle plan changes, renewals, and reactivations."""
    customer_id = sub.get("customer")
    if not customer_id:
        return

    user = _find_user_by_customer_id(db, customer_id)
    if not user:
        logger.warning(f"subscription.updated: no user for customer={customer_id}")
        return

    sub_status = sub.get("status")

    # If the subscription is no longer active, don't upgrade.
    if sub_status not in ("active", "trialing"):
        logger.info(f"subscription.updated: status={sub_status}, skipping plan update")
        return

    # If cancel_at_period_end just got set, don't downgrade yet.
    if sub.get("cancel_at_period_end"):
        logger.info(f"subscription.updated: cancel_at_period_end=True for user {user.id}, "
                     f"keeping current plan")
        return

    price_id = sub["items"]["data"][0]["price"]["id"]
    plan = PRICE_TO_PLAN.get(price_id, user.subscription)

    _update_user_subscription(db, user, plan, subscription_id=sub["id"])
    logger.info(f"🔄 Subscription updated: user {user.id} → {plan}")


def _handle_subscription_deleted(db: Session, sub: dict) -> None:
    """Subscription cancelled or expired – downgrade to free."""
    customer_id = sub.get("customer")
    if not customer_id:
        return

    user = _find_user_by_customer_id(db, customer_id)
    if not user:
        logger.warning(f"subscription.deleted: no user for customer={customer_id}")
        return

    _update_user_subscription(db, user, "free")
    logger.info(f"❌ Subscription ended: user {user.id} → free")


def _handle_payment_failed(db: Session, invoice: dict) -> None:
    """Log payment failure. We don't downgrade immediately – Stripe retries."""
    customer_id = invoice.get("customer")
    if not customer_id:
        return

    user = _find_user_by_customer_id(db, customer_id)
    if user:
        logger.warning(f"⚠️ Payment failed for user {user.id} ({user.email})")
