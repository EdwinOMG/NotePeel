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

    # ── 1. Feature Gate (Kept as is) ──────────────────────────────────────────
    def assert_feature_allowed(self, user: User, feature: str) -> None:
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

    # ── 2. Pre-call Budget Check (Kept as is) ─────────────────────────────────
    def assert_budget_available(self, db: Session, user: User, feature: str) -> DailyUsage:
        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS[plan_name]
        today = date.today()

        row = self._get_or_create_today(db, user.id, today)

        if row.requests_made >= limits.max_requests_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "DAILY_REQUEST_LIMIT",
                    "message": "Daily AI request limit reached. Resets at midnight UTC.",
                }
            )

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

    # ── 3. Post-call recording (FIXED) ───────────────────────────────────────
    def record_usage(self, db: Session, user: User, feature: str, tokens_used: int, weight: float = 1.0) -> None:
        today = date.today()
        
        # 1. Fetch the row (don't use with_for_update here to avoid deadlocks on first row creation)
        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user.id,
            DailyUsage.date == today,
        ).first()

        if not row:
            # Fallback creation if _get_or_create_today wasn't used
            row = DailyUsage(
                user_id=user.id,
                date=today,
                tokens_used=tokens_used,
                requests_made=float(weight), # Force float
            )
            db.add(row)
        else:
            # 2. Update existing row using explicit float conversion
            # This handles cases where the DB might try to treat it as an int
            current_reqs = float(row.requests_made or 0.0)
            row.requests_made = current_reqs + float(weight)
            
            row.tokens_used = (row.tokens_used or 0) + tokens_used
            row.updated_at = datetime.utcnow()
            db.add(row)

        # 3. CRITICAL: Commit immediately so usage is saved even if the next step fails
        try:
            db.commit()
            db.refresh(row)
            print(f"DEBUG: Usage Recorded - User {user.id} | +{weight} reqs | Total: {row.requests_made}")
        except Exception as e:
            db.rollback()
            print(f"ERROR saving usage: {e}")

    # ── 4. Budget Summary (Kept as is) ────────────────────────────────────────
    def get_budget_summary(self, db: Session, user: User) -> dict:
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

    # ── 5. Internal Helper (RE-FIXED) ─────────────────────────────────────────
    def _get_or_create_today(self, db: Session, user_id: int, today: date) -> DailyUsage:
        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user_id,
            DailyUsage.date == today,
        ).first()

        if not row:
            try:
                # Use a fresh instance
                new_row = DailyUsage(
                    user_id=user_id,
                    date=today,
                    tokens_used=0,
                    requests_made=0.0, # Initialize as float
                )
                db.add(new_row)
                db.commit()
                db.refresh(new_row)
                return new_row
            except Exception:
                db.rollback()
                # Fetch again in case another concurrent request created it
                return db.query(DailyUsage).filter(DailyUsage.user_id == user_id, DailyUsage.date == today).first()
        return row

usage_service = UsageService()