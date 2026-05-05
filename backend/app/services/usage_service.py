from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.usage import DailyUsage, MonthlyAIUsage, MonthlyOCRUsage
from app.plan_limits import PLAN_LIMITS, PRO_ONLY_FEATURES, PREMIUM_ONLY_FEATURES


def _is_dev_user(user: User) -> bool:
    """Check if user email is in the DEV_EMAILS list (bypasses all limits)."""
    from app.config import get_settings
    settings = get_settings()
    if not settings.dev_emails:
        return False
    dev_list = [e.strip().lower() for e in settings.dev_emails.split(",") if e.strip()]
    return user.email.lower() in dev_list

# These help with the pre-check estimate before the AI call happens
FEATURE_ESTIMATED_TOKENS: dict[str, int] = {
    "scan": 800,
    "summarize": 600,
    "explain": 300,
    "flashcards": 1_200,
    "chat": 500,
}

class UsageService:

    # ── 1. Feature Gate ───────────────────────────────────────────────────────
    def assert_feature_allowed(self, user: User, feature: str) -> None:
        if _is_dev_user(user):
            return  # Dev accounts bypass all feature gates

        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)

        if not limits or feature not in limits.allowed_features:
            # Determine upgrade target
            if feature in PREMIUM_ONLY_FEATURES:
                upgrade_msg = f"'{feature}' is not available on the {plan_name} plan. Upgrade to Premium."
            else:
                upgrade_msg = f"'{feature}' is not available on the {plan_name} plan. Upgrade to Pro."

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FEATURE_NOT_ALLOWED",
                    "feature": feature,
                    "plan": plan_name,
                    "message": upgrade_msg,
                },
            )

    # ── 2. Pre-call Budget Check (daily + monthly) ───────────────────────────
    def assert_budget_available(self, db: Session, user: User, feature: str) -> None:
        """
        Checks the user's AI request budget before any AI feature call.

        Free:    daily cap only (4/day shared). No monthly cap.
        Pro:     daily cap (100/day) + monthly cap (300/month).
        Premium: daily cap (150/day) + monthly cap (1,000/month).

        OCR on Free draws from this budget (weight=1.0).
        OCR on Pro/Premium uses a separate counter — do NOT call this for OCR on those tiers.
        """
        if _is_dev_user(user):
            return  # Dev accounts bypass all budget checks

        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)
        today = date.today()

        # --- Daily cap (all tiers) ---
        daily_row = self._get_or_create_today(db, user.id, today)
        if daily_row.requests_made >= limits.max_ai_requests_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "DAILY_LIMIT_REACHED",
                    "message": "Daily request limit reached. Resets at midnight UTC.",
                }
            )

        # --- Monthly cap (Pro and Premium only) ---
        if limits.max_ai_requests_per_month is not None:
            monthly_row = self._get_or_create_ai_month(db, user.id, today.year, today.month)
            if monthly_row.requests_made >= limits.max_ai_requests_per_month:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "code": "MONTHLY_LIMIT_REACHED",
                        "message": "Monthly request limit reached. Resets on the 1st of next month.",
                    }
                )

    # ── 3. Post-call Recording (daily + monthly) ─────────────────────────────
    def record_usage(self, db: Session, user: User, feature: str, tokens_used: int, weight: float = 1.0) -> None:
        """
        Increments daily and (for Pro/Premium) monthly AI request counters by `weight`.
        """
        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)
        today = date.today()

        daily_row = self._get_or_create_today(db, user.id, today)
        daily_row.requests_made = float(daily_row.requests_made or 0) + weight
        daily_row.tokens_used   = (daily_row.tokens_used or 0) + tokens_used
        daily_row.updated_at    = datetime.utcnow()
        db.add(daily_row)

        if limits.max_ai_requests_per_month is not None:
            monthly_row = self._get_or_create_ai_month(db, user.id, today.year, today.month)
            monthly_row.requests_made = float(monthly_row.requests_made or 0) + weight
            monthly_row.updated_at    = datetime.utcnow()
            db.add(monthly_row)

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"ERROR saving AI usage: {e}")

    # ── 4. OCR Enforcement ────────────────────────────────────────────────────
    def assert_ocr_allowed(self, db: Session, user: User) -> None:
        """
        Gate for OCR scans. Behaviour differs by tier:

        Free:     OCR is checked via assert_budget_available (weight=1.0 from shared AI budget).
                  Do NOT call this method for Free users — call assert_budget_available instead.

        Pro:      Separate monthly counter, hard cap of 100/month.
        Premium:  Separate monthly counter, silent hard cap of 5,000/month (generic error message).
        """
        if _is_dev_user(user):
            return  # Dev accounts bypass all OCR limits

        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)

        if limits.ocr_uses_ai_budget:
            # Free: delegate to the shared budget check
            self.assert_budget_available(db, user, "scan")
            return

        today = date.today()
        monthly_row = self._get_or_create_ocr_month(db, user.id, today.year, today.month)

        # Pro: visible monthly cap
        if limits.max_ocr_scans_per_month is not None:
            if monthly_row.scans_made >= limits.max_ocr_scans_per_month:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "code": "MONTHLY_SCAN_LIMIT",
                        "message": "Monthly scan limit reached. Resets on the 1st of next month.",
                    }
                )

        # All tiers: silent hard cap (never expose the number)
        if monthly_row.scans_made >= limits.ocr_silent_monthly_cap:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "SCAN_UNAVAILABLE",
                    "message": "Scanning is temporarily unavailable. Please try again later.",
                }
            )

    def record_ocr_scan(self, db: Session, user: User) -> None:
        """
        Call after a successful OCR scan.

        Free:     Records weight=1.0 against the shared AI daily budget via record_usage.
        Pro/Premium: Increments the separate monthly OCR counter only.
        """
        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)

        if limits.ocr_uses_ai_budget:
            # Free: OCR costs 1 full AI request from the shared daily budget
            self.record_usage(db, user, "scan", tokens_used=0, weight=1.0)
            return

        today = date.today()
        monthly_row = self._get_or_create_ocr_month(db, user.id, today.year, today.month)
        monthly_row.scans_made += 1
        monthly_row.updated_at  = datetime.utcnow()
        db.add(monthly_row)

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"ERROR saving OCR usage: {e}")

    # ── 5. Budget Summary ─────────────────────────────────────────────────────
    def get_budget_summary(self, db: Session, user: User) -> dict:
        # Dev accounts get premium-level summary with unlimited everything
        if _is_dev_user(user):
            return {
                "plan": "premium",
                "ai_requests": {
                    "daily_used": 0,
                    "daily_limit": 999,
                    "daily_remaining": 999,
                    "monthly_used": 0,
                    "monthly_limit": 99999,
                    "monthly_remaining": 99999,
                },
                "ocr": {
                    "counter": "separate",
                    "monthly_used": 0,
                    "monthly_limit": "unlimited",
                },
                "allowed_features": sorted({"scan", "summarize", "explain", "flashcards", "chat"}),
                "pro_only_features": sorted(PRO_ONLY_FEATURES),
                "premium_only_features": sorted(PREMIUM_ONLY_FEATURES),
                "resets_at": "dev account — no limits",
            }

        plan_name = user.subscription.lower() if hasattr(user.subscription, 'lower') else str(user.subscription)
        limits = PLAN_LIMITS.get(plan_name)
        today = date.today()

        daily_row = self._get_or_create_today(db, user.id, today)
        daily_used = float(daily_row.requests_made or 0)
        daily_remaining = max(0, limits.max_ai_requests_per_day - daily_used)

        summary = {
            "plan": plan_name,
            "ai_requests": {
                "daily_used":      daily_used,
                "daily_limit":     limits.max_ai_requests_per_day,
                "daily_remaining": daily_remaining,
            },
            "allowed_features": sorted(limits.allowed_features),
            "pro_only_features": sorted(PRO_ONLY_FEATURES),
            "premium_only_features": sorted(PREMIUM_ONLY_FEATURES),
            "resets_at": "midnight UTC",
        }

        # Monthly AI budget (Pro/Premium only)
        if limits.max_ai_requests_per_month is not None:
            monthly_row = self._get_or_create_ai_month(db, user.id, today.year, today.month)
            monthly_used = float(monthly_row.requests_made or 0)
            summary["ai_requests"]["monthly_used"]      = monthly_used
            summary["ai_requests"]["monthly_limit"]     = limits.max_ai_requests_per_month
            summary["ai_requests"]["monthly_remaining"] = max(0, limits.max_ai_requests_per_month - monthly_used)

        # OCR budget
        if limits.ocr_uses_ai_budget:
            # Free: OCR headroom is the same as the shared AI daily remaining
            summary["ocr"] = {
                "counter": "shared",
                "daily_remaining": daily_remaining,
            }
        else:
            ocr_row = self._get_or_create_ocr_month(db, user.id, today.year, today.month)
            ocr_used = ocr_row.scans_made
            if limits.max_ocr_scans_per_month is not None:
                # Pro: show real monthly limit
                summary["ocr"] = {
                    "counter":          "separate",
                    "monthly_used":     ocr_used,
                    "monthly_limit":    limits.max_ocr_scans_per_month,
                    "monthly_remaining": max(0, limits.max_ocr_scans_per_month - ocr_used),
                }
            else:
                # Premium: show "unlimited" (do not expose silent cap)
                summary["ocr"] = {
                    "counter":      "separate",
                    "monthly_used": ocr_used,
                    "monthly_limit": "unlimited",
                }

        return summary

    # ── 6. Internal Helpers ───────────────────────────────────────────────────
    def _get_or_create_today(self, db: Session, user_id: int, today: date) -> DailyUsage:
        row = db.query(DailyUsage).filter(
            DailyUsage.user_id == user_id,
            DailyUsage.date == today,
        ).first()

        if not row:
            try:
                new_row = DailyUsage(
                    user_id=user_id,
                    date=today,
                    tokens_used=0,
                    requests_made=0.0,
                    ocr_scans=0,
                )
                db.add(new_row)
                db.commit()
                db.refresh(new_row)
                return new_row
            except Exception:
                db.rollback()
                return db.query(DailyUsage).filter(
                    DailyUsage.user_id == user_id,
                    DailyUsage.date == today,
                ).first()
        return row

    def _get_or_create_ai_month(self, db: Session, user_id: int, year: int, month: int):
        row = db.query(MonthlyAIUsage).filter(
            MonthlyAIUsage.user_id == user_id,
            MonthlyAIUsage.year    == year,
            MonthlyAIUsage.month   == month,
        ).first()
        if not row:
            try:
                row = MonthlyAIUsage(user_id=user_id, year=year, month=month, requests_made=0)
                db.add(row)
                db.flush()
            except Exception:
                db.rollback()
                row = db.query(MonthlyAIUsage).filter(
                    MonthlyAIUsage.user_id == user_id,
                    MonthlyAIUsage.year    == year,
                    MonthlyAIUsage.month   == month,
                ).first()
        return row

    def _get_or_create_ocr_month(self, db: Session, user_id: int, year: int, month: int):
        row = db.query(MonthlyOCRUsage).filter(
            MonthlyOCRUsage.user_id == user_id,
            MonthlyOCRUsage.year    == year,
            MonthlyOCRUsage.month   == month,
        ).first()
        if not row:
            try:
                row = MonthlyOCRUsage(user_id=user_id, year=year, month=month, scans_made=0)
                db.add(row)
                db.flush()
            except Exception:
                db.rollback()
                row = db.query(MonthlyOCRUsage).filter(
                    MonthlyOCRUsage.user_id == user_id,
                    MonthlyOCRUsage.year    == year,
                    MonthlyOCRUsage.month   == month,
                ).first()
        return row

usage_service = UsageService()
