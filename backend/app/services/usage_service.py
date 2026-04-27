from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.usage import DailyUsage
from app.plan_limits import PLAN_LIMITS, PRO_ONLY_FEATURES

# These help with the pre-check estimate before the AI call happens
FEATURE_ESTIMATED_TOKENS: dict[str, int] = {
    "scan": 800,
    "summarize": 600,
    "explain": 300,
    "flashcards": 1_200,
}

class UsageService:

    # ── 1. Feature Gate ──────────────────────────────────────────────────────
    def assert_feature_allowed(self, user: User, feature: str) -> None:
        """Checks if the user's plan even supports this feature."""
        # Ensure user.subscription matches keys in PLAN_LIMITS (e.g., 'free', 'pro')
        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)
        
        if not limits or feature not in limits.allowed_features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FEATURE_NOT_ALLOWED",
                    "feature": feature,
                    "plan": plan_name,
                    "message": f"'{feature}' is not available on the {plan_name} plan. Upgrade to Pro.",
                },
            )

    # ── 2. Pre-call Budget Check ─────────────────────────────────────────────
    def assert_budget_available(self, db: Session, user: User, feature: str) -> DailyUsage:
        """Checks if user has enough requests/tokens left before calling AI."""
        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS[plan_name]
        today = date.today()

        # Get the row (creates it with 0s if it doesn't exist)
        row = self._get_or_create_today(db, user.id, today)

        # Check request count
        if row.requests_made >= limits.max_requests_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "DAILY_REQUEST_LIMIT",
                    "message": "Daily AI request limit reached. Resets at midnight UTC.",
                }
            )

        # Check token budget using an estimate
        estimated = FEATURE_ESTIMATED_TOKENS.get(feature, 500)
        if row.tokens_used + estimated > limits.daily_token_budget:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "DAILY_TOKEN_LIMIT",
                    "message": "Daily token budget reached. Resets at midnight UTC.",
                }
            )

        return row

    # ── 3. Post-call recording ───────────────────────────────────────────────
    def record_usage(self, db: Session, user: User, feature: str, tokens_used: int, weight: float = 1.0) -> None:
        """
        Updates the usage row. 
        Note: We use db.flush() instead of db.commit() here. 
        This allows the Controller to commit everything (Usage + AI Result) in one go.
        """
        today = date.today()
        
        # Lock the row for update to prevent race conditions
        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user.id,
            DailyUsage.date == today,
        ).first()

        if not row:
            # If it somehow doesn't exist (safety fallback), create and COMMIT immediately
            row = DailyUsage(
                user_id=user.id,
                date=today,
                tokens_used=tokens_used,
                requests_made=weight,
            )
            db.add(row)
            db.commit() # Persistent save
            print(f"DEBUG: Created and Committed new usage for User {user.id}")
        else:
            # Update existing row
            row.tokens_used += tokens_used
            row.requests_made += float(weight)
            row.updated_at = datetime.utcnow()
            db.add(row) 
            db.commit() 
            print(f"DEBUG: Updated and Committed usage for User {user.id}: +{tokens_used} tokens")
            

    # ── 4. Budget Summary ────────────────────────────────────────────────────
    def get_budget_summary(self, db: Session, user: User) -> dict:
        """Returns data for the frontend usage banner."""
        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)
        today = date.today()

        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user.id,
            DailyUsage.date == today,
        ).first()

        tokens_used = row.tokens_used if row else 0
        requests_made = row.requests_made if row else 0

        return {
            "plan": plan_name,
            "daily_token_budget": limits.daily_token_budget,
            "tokens_used_today": tokens_used,
            "tokens_remaining_today": max(0, limits.daily_token_budget - tokens_used),
            "requests_made_today": requests_made,
            "max_requests_per_day": limits.max_requests_per_day,
            "allowed_features": sorted(limits.allowed_features),
            "pro_only_features": sorted(PRO_ONLY_FEATURES),
            "resets_at": "midnight UTC",
        }

    # ── 5. Internal Helper ───────────────────────────────────────────────────
    def _get_or_create_today(self, db: Session, user_id: int, today: date) -> DailyUsage:
        """Ensures a record exists for today so we can increment it later."""
        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user_id,
            DailyUsage.date == today,
        ).first()

        if not row:
            # Use a sub-transaction (nested) or a clean commit to ensure this exists
            try:
                new_row = DailyUsage(
                    user_id=user_id,
                    date=today,
                    tokens_used=0,
                    requests_made=0,
                )
                db.add(new_row)
                db.commit()
                return new_row
            except Exception as e:
                db.rollback()
                # If someone else created it while we were trying to, just fetch it
                return db.query(DailyUsage).filter(DailyUsage.user_id == user_id, DailyUsage.date == today).first()
        return row

usage_service = UsageService()