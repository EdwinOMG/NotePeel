from dataclasses import dataclass
from typing import Optional, Set


@dataclass(frozen=True)
class PlanLimits:
    # AI feature budget (summarize, explain, flashcards, chat — weighted)
    max_ai_requests_per_day: Optional[int]      # None = no daily cap (use monthly only)
    max_ai_requests_per_month: Optional[int]    # None = no monthly cap (Free uses daily only)

    # OCR scan budget (separate from AI budget on Pro/Premium; None = draws from AI budget on Free)
    ocr_uses_ai_budget: bool                    # True for Free; False for Pro/Premium
    max_ocr_scans_per_month: Optional[int]      # None = unlimited (subject to silent cap)
    ocr_silent_monthly_cap: int                 # Hard cap, never shown to user

    allowed_features: Set[str]


PLAN_LIMITS: dict[str, PlanLimits] = {
    "free": PlanLimits(
        max_ai_requests_per_day=4,
        max_ai_requests_per_month=None,         # Free is daily-only
        ocr_uses_ai_budget=True,                # OCR costs 1.0 from the shared AI budget
        max_ocr_scans_per_month=None,           # No separate OCR counter for Free
        ocr_silent_monthly_cap=5000,
        allowed_features={"scan", "summarize", "explain"},
    ),
    "pro": PlanLimits(
        max_ai_requests_per_day=100,
        max_ai_requests_per_month=300,
        ocr_uses_ai_budget=False,               # OCR tracked separately
        max_ocr_scans_per_month=100,
        ocr_silent_monthly_cap=5000,
        allowed_features={"scan", "summarize", "explain", "flashcards"},
    ),
    "premium": PlanLimits(
        max_ai_requests_per_day=150,
        max_ai_requests_per_month=1000,
        ocr_uses_ai_budget=False,               # OCR tracked separately
        max_ocr_scans_per_month=None,           # Unlimited (silent cap enforced below)
        ocr_silent_monthly_cap=5000,
        allowed_features={"scan", "summarize", "explain", "flashcards", "chat"},
    ),
}

PRO_ONLY_FEATURES: Set[str] = {"flashcards"}
PREMIUM_ONLY_FEATURES: Set[str] = {"chat"}
