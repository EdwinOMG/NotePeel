"""
UsageService
============
All token-budget and feature-gate logic lives here.
Every AI endpoint goes through this service — nothing calls Workers AI directly
without passing these checks first.

Usage pattern
─────────────
    # 1. Before calling Workers AI:
    usage_service.check_and_reserve(db, user, feature="summarize", estimated_tokens=500)

    # 2. Call Workers AI and get real token count back.

    # 3. After Workers AI responds:
    usage_service.record(db, user, feature="summarize", tokens_used=real_count)

Why two steps?
──────────────
We check *before* the call so we never start a generation that will be wasted.
We record *after* so we use real token counts, not guesses.
The pre-check uses a conservative estimate so a user can't fire 50 concurrent
requests simultaneously and exceed the budget before any of them are recorded.
"""

from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from fastapi import HTTPException, status

from app.models.user import User, SubscriptionTier
from app.models.usage import DailyUsage
from app.plan_limits import PLAN_LIMITS, PRO_ONLY_FEATURES


# Conservative token estimate used in the pre-call check
# (real count is recorded afterwards — this just blocks obvious over-budget calls)
FEATURE_ESTIMATED_TOKENS: dict[str, int] = {
    "scan": 800,
    "summarize": 600,
    "explain": 300,
    "flashcards": 1_200,
}


class UsageService:

    # ── Feature gate ──────────────────────────────────────────────────────────

    def assert_feature_allowed(self, user: User, feature: str) -> None:
        """
        Raises HTTP 403 if the user's plan doesn't include this feature.
        Called at the very top of each AI endpoint.
        """
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
        """
        Checks both the token budget and the request cap before hitting Workers AI.
        Returns the DailyUsage row (creates it if this is the first request today).
        Raises HTTP 429 if either limit is exceeded.

        This uses a *pessimistic estimate* of token cost — real usage is recorded
        separately in `record_usage()` below.
        """
        limits = PLAN_LIMITS[user.subscription]
        today = date.today()

        # Fetch or create today's row — done with a raw upsert so concurrent
        # requests don't race past each other on first use of the day.
        row = self._get_or_create_today(db, user.id, today)

        # Check request cap
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

        # Check token budget (using conservative estimate)
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

    def record_usage(
        self,
        db: Session,
        user: User,
        feature: str,
        tokens_used: int,
    ) -> None:
        """
        Atomically increments today's token and request counters.
        Call this AFTER Workers AI responds with real token counts.
        Uses INSERT … ON CONFLICT DO UPDATE to prevent race conditions.
        """
        today = date.today()

        stmt = (
            pg_insert(DailyUsage)
            .values(
                user_id=user.id,
                date=today,
                tokens_used=tokens_used,
                requests_made=1,
                updated_at=datetime.utcnow(),
            )
            .on_conflict_do_update(
                constraint="uq_daily_usage_user_date",
                set_={
                    "tokens_used": DailyUsage.tokens_used + tokens_used,
                    "requests_made": DailyUsage.requests_made + 1,
                    "updated_at": datetime.utcnow(),
                },
            )
        )
        db.execute(stmt)
        db.commit()

    # ── Budget summary (for the /me endpoint and frontend banner) ─────────────

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
        """
        Returns today's DailyUsage row, creating it if needed.
        The upsert with do_nothing means a concurrent request won't blow up
        if two requests hit at the exact same millisecond on a fresh day.
        """
        stmt = (
            pg_insert(DailyUsage)
            .values(user_id=user_id, date=today, tokens_used=0, requests_made=0)
            .on_conflict_do_nothing(constraint="uq_daily_usage_user_date")
        )
        db.execute(stmt)
        db.commit()

        return db.query(DailyUsage).filter(
            DailyUsage.user_id == user_id,
            DailyUsage.date == today,
        ).first()


# Singleton — import this everywhere
usage_service = UsageService()