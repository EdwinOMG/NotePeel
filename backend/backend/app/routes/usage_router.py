

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.controllers.auth_controller import get_current_user
from app.models.user import User
from app.services.usage_service import usage_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/usage")
def get_my_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the current user's daily token usage and plan limits.
    Called by the frontend UsageBanner on mount and every 60 seconds.
    """
    return usage_service.get_budget_summary(db, current_user)