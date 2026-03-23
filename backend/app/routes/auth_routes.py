from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_db
from app.config import get_settings
from app.schemas.user_schema import UserCreate, UserLogin, UserResponse, Token, GoogleAuthRequest
from app.controllers.auth_controller import auth_controller, AuthController, get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/register", response_model=UserResponse, status_code=201)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    user = auth_controller.create_user(db, user_data)
    return user


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token."""
    return auth_controller.login(db, credentials.email, credentials.password)


@router.post("/google", response_model=Token)
def google_login(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate with Google and return access token."""
    try:
        idinfo = id_token.verify_oauth2_token(
            request.credential,
            google_requests.Request(),
            settings.google_client_id
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

    google_id = idinfo["sub"]
    email = idinfo["email"]
    name = idinfo.get("name", email.split("@")[0])

    # Check if user exists by google_id
    user = db.query(User).filter(User.google_id == google_id).first()

    if not user:
        # Check if email already exists (link accounts)
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_id
            db.commit()
        else:
            # Create new user
            username = name.replace(" ", "_").lower()
            # Ensure unique username
            base_username = username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}_{counter}"
                counter += 1

            user = User(
                email=email,
                username=username,
                google_id=google_id,
                hashed_password=None
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    access_token = AuthController.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )

    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return current_user
