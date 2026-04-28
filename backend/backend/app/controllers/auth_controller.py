from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.database import get_db
from app.config import get_settings
from app.models.user import User

settings = get_settings()
security = HTTPBearer()


class AuthController:
    """Controller for authentication operations (Google + Microsoft OAuth)."""

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

    @staticmethod
    def decode_token(token: str) -> dict:
        """Decode and verify a JWT token."""
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get a user by email."""
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        """Get a user by ID."""
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_or_create_oauth_user(
        db: Session,
        provider: str,
        provider_id: str,
        email: str,
        name: str,
        picture: Optional[str] = None
    ) -> User:
        """Find existing user by provider ID or email, or create a new one.
        
        Args:
            provider: 'google' or 'microsoft'
            provider_id: The unique ID from the OAuth provider
            email: User's email address
            name: User's display name
            picture: URL to profile picture
        """
        id_column = User.google_id if provider == "google" else User.microsoft_id

        # First try by provider ID
        user = db.query(User).filter(id_column == provider_id).first()
        if user:
            if picture and user.profile_picture != picture:
                user.profile_picture = picture
                db.commit()
            return user

        # Then try by email (link accounts)
        user = db.query(User).filter(User.email == email).first()
        if user:
            if provider == "google":
                user.google_id = provider_id
            else:
                user.microsoft_id = provider_id
            if picture:
                user.profile_picture = picture
            db.commit()
            return user

        # Create new user
        username = name.replace(" ", "_").lower()
        # Remove non-alphanumeric chars except underscores
        username = "".join(c for c in username if c.isalnum() or c == "_")
        base_username = username
        counter = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}_{counter}"
            counter += 1

        user_kwargs = {
            "email": email,
            "username": username,
            "profile_picture": picture,
        }
        if provider == "google":
            user_kwargs["google_id"] = provider_id
        else:
            user_kwargs["microsoft_id"] = provider_id

        user = User(**user_kwargs)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


auth_controller = AuthController()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to get the current authenticated user."""
    token = credentials.credentials
    payload = AuthController.decode_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user = AuthController.get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user
