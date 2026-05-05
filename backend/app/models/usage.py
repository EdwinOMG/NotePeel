from sqlalchemy import Column, Integer, Float, BigInteger, Date, DateTime, ForeignKey, UniqueConstraint, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class DailyUsage(Base):
    """
    Tracks token consumption and request counts per user per UTC day.
    One row per (user_id, date) — enforced by the unique constraint.
    """
    __tablename__ = "daily_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_usage_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    # Cumulative counters for the day
    tokens_used = Column(BigInteger, nullable=False, default=0)
    requests_made = Column(Float, nullable=False, default=0.0)
    ocr_scans = Column(Integer, nullable=False, default=0)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="daily_usages")


class MonthlyAIUsage(Base):
    """
    Tracks weighted AI request consumption per user per calendar month.
    Enforces the monthly budget cap for Pro (300) and Premium (1,000).
    Not used for Free (Free is daily-only).
    """
    __tablename__ = "monthly_ai_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_monthly_ai_user_month"),
    )

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    year           = Column(Integer, nullable=False)
    month          = Column(Integer, nullable=False)
    requests_made  = Column(Numeric(10, 2), nullable=False, default=0)  # weighted total
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="monthly_ai_usages")


class MonthlyOCRUsage(Base):
    """
    Tracks OCR scan count per user per calendar month.
    Used for Pro (100/month hard cap) and Premium (5,000 silent cap).
    Not used for Free (OCR draws from the shared AI daily budget instead).
    """
    __tablename__ = "monthly_ocr_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_monthly_ocr_user_month"),
    )

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    year       = Column(Integer, nullable=False)
    month      = Column(Integer, nullable=False)
    scans_made = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="monthly_ocr_usages")
