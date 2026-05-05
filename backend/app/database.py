from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

settings = get_settings()

db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all database tables and add any missing columns."""
    from app.models.user import User
    from app.models.usage import DailyUsage
    Base.metadata.create_all(bind=engine)

    # ── Add columns that may be missing from existing tables ──────
    # SQLAlchemy's create_all won't alter existing tables, so we do
    # it manually with raw SQL. Each statement is idempotent.
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        existing_columns = {col["name"] for col in inspector.get_columns("users")}
        with engine.begin() as conn:
            if "stripe_customer_id" not in existing_columns:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE"
                ))
                print("✅ Added stripe_customer_id column to users table")
            if "stripe_subscription_id" not in existing_columns:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255) UNIQUE"
                ))
                print("✅ Added stripe_subscription_id column to users table")
