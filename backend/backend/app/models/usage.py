from sqlalchemy import Column, Integer, Float, BigInteger, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class DailyUsage(Base):
    """
    Tracks token consumption and request counts per user per UTC day.
    One row per (user_id, date) — enforced by the unique constraint.
    The unique constraint is the real guard; the index just speeds up lookups.
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

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="daily_usages")