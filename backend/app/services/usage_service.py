from datetime import date, datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, SubscriptionTier
from app.models.usage import DailyUsage
from app.plan_limits import PLAN_LIMITS, PRO_ONLY_FEATURES


FEATURE_ESTIMATED_TOKENS: dict[str, int] = {
    "scan": 800,
    "summarize": 600,
    "explain": 300,
    "flashcards": 1_200,
}


class UsageService:

    # ── Feature gate ──────────────────────────────────────────────────────────

    def assert_feature_allowed(self, user: User, feature: str) -> None:
        limits = PLAN_LIMITS[user.subscription]
        if feature not in limits.allowed_features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FEATURE_NOT_ALLOWED",
                    "feature": feature,
                    "plan": user.subscription,
                    "message": f"'{feature}' is not available on the {user.subscription} plan. Upgrade to Pro to unlock it.",
                },
            )

    # ── Pre-call budget check ─────────────────────────────────────────────────

    def assert_budget_available(self, db: Session, user: User, feature: str) -> DailyUsage:
        limits = PLAN_LIMITS[user.subscription]
        today = date.today()

        row = self._get_or_create_today(db, user.id, today)

        if row.requests_made >= limits.max_requests_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "DAILY_REQUEST_LIMIT",
                    "requests_made": row.requests_made,
                    "limit": limits.max_requests_per_day,
                    "message": f"You've used all {limits.max_requests_per_day} AI requests for today. Resets at midnight UTC.",
                },
                headers={"Retry-After": "86400"},
            )

        estimated = FEATURE_ESTIMATED_TOKENS.get(feature, 500)
        if row.tokens_used + estimated > limits.daily_token_budget:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "DAILY_TOKEN_LIMIT",
                    "tokens_used": row.tokens_used,
                    "limit": limits.daily_token_budget,
                    "message": f"Daily token budget reached ({row.tokens_used:,} / {limits.daily_token_budget:,}). Resets at midnight UTC.",
                },
                headers={"Retry-After": "86400"},
            )

        return row

    # ── Post-call recording ───────────────────────────────────────────────────

    def record_usage(self, db: Session, user: User, feature: str, tokens_used: int, weight: float = 1.0) -> None:
        today = date.today()
        
        # Use with_for_update to handle concurrent requests safely
        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user.id,
            DailyUsage.date == today,
        ).with_for_update().first()

        if row:
            row.tokens_used += tokens_used
            row.requests_made += weight  # Now adds 1.0 or 0.5
            row.updated_at = datetime.utcnow()
        else:
            row = DailyUsage(
                user_id=user.id,
                date=today,
                tokens_used=tokens_used,
                requests_made=weight,
            )
            db.add(row)

        print(f"DEBUG: Recording {tokens_used} tokens and {weight} requests for User {user.id}")
        db.commit()

    # ── Budget summary ────────────────────────────────────────────────────────

    def get_budget_summary(self, db: Session, user: User) -> dict:
        limits = PLAN_LIMITS[user.subscription]
        today = date.today()

        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user.id,
            DailyUsage.date == today,
        ).first()

        tokens_used = row.tokens_used if row else 0
        requests_made = row.requests_made if row else 0

        return {
            "plan": user.subscription,
            "daily_token_budget": limits.daily_token_budget,
            "tokens_used_today": tokens_used,
            "tokens_remaining_today": max(0, limits.daily_token_budget - tokens_used),
            "requests_made_today": requests_made,
            "max_requests_per_day": limits.max_requests_per_day,
            "allowed_features": sorted(limits.allowed_features),
            "pro_only_features": sorted(PRO_ONLY_FEATURES),
            "resets_at": "midnight UTC",
        }

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _get_or_create_today(self, db: Session, user_id: int, today: date) -> DailyUsage:
        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user_id,
            DailyUsage.date == today,
        ).first()

        if not row:
            row = DailyUsage(
                user_id=user_id,
                date=today,
                tokens_used=0,
                requests_made=0,
            )
            db.add(row)
            db.commit()
            db.refresh(row)

        return row


usage_service = UsageService()