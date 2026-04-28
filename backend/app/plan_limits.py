from dataclasses import dataclass
from typing import Set


@dataclass(frozen=True)
class PlanLimits:
    daily_token_budget: int   # total input+output tokens allowed per UTC day
    max_requests_per_day: int # hard cap on AI requests regardless of token size
    allowed_features: Set[str]


# adjust free tier
PLAN_LIMITS: dict[str, PlanLimits] = {
    "free": PlanLimits(
        daily_token_budget=10_000,
        max_requests_per_day=4,
        # flashcards not accessible to free users 
        allowed_features={"scan", "summarize", "explain"},
    ),
    "pro": PlanLimits(
        daily_token_budget=500_000,
        max_requests_per_day=1_000,
        allowed_features={"scan", "summarize", "explain", "flashcards"},
    ),
}

# Features blocked on free, used by the frontend to show lock icons
PRO_ONLY_FEATURES: Set[str] = {"flashcards"}