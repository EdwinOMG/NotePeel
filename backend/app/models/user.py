from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    PREMIUM = "premium"


class User(Base):
    """User model for OAuth authentication (Google + Microsoft)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    google_id = Column(String(255), unique=True, nullable=True)
    microsoft_id = Column(String(255), unique=True, nullable=True)
    profile_picture = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Subscription — default everyone to free
    subscription = Column(
        String(10),
        nullable=False,
        default="free",
        server_default="free",
    )

    # Stripe fields
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)

    # Relationships
    notes = relationship("Note", back_populates="owner")
    notebooks = relationship("Notebook", back_populates="owner", cascade="all, delete-orphan")
    shared_notebooks = relationship("NotebookCollaborator", back_populates="user", cascade="all, delete-orphan")
    daily_usages = relationship("DailyUsage", back_populates="user", cascade="all, delete-orphan")
    monthly_ai_usages  = relationship("MonthlyAIUsage",  back_populates="user", cascade="all, delete-orphan")
    monthly_ocr_usages = relationship("MonthlyOCRUsage", back_populates="user", cascade="all, delete-orphan")
