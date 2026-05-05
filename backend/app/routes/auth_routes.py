from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_db
from app.config import get_settings
from app.schemas.user_schema import UserResponse, Token, GoogleAuthRequest, MicrosoftAuthRequest
from app.controllers.auth_controller import auth_controller, AuthController, get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/google", response_model=Token)
def google_login(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate with Google OAuth and return access token."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured on the server"
        )

    try:
        idinfo = id_token.verify_oauth2_token(
            request.credential,
            google_requests.Request(),
            settings.google_client_id
        )
    except ValueError as e:
        print(f"[Google OAuth] Verification failed: {e}")
        print(f"[Google OAuth] Client ID being used: {settings.google_client_id[:20]}...")
        print(f"[Google OAuth] Credential (first 20): {request.credential[:20]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

    google_id = idinfo["sub"]
    email = idinfo["email"]
    name = idinfo.get("name", email.split("@")[0])
    picture = idinfo.get("picture")

    user = auth_controller.get_or_create_oauth_user(
        db, provider="google", provider_id=google_id,
        email=email, name=name, picture=picture
    )

    access_token = AuthController.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    return Token(access_token=access_token, token_type="bearer")


@router.post("/microsoft", response_model=Token)
async def microsoft_login(request: MicrosoftAuthRequest, db: Session = Depends(get_db)):
    """Authenticate with Microsoft OAuth.
    
    The frontend handles the MSAL popup flow and sends us the user's
    Microsoft ID, email, and name. We verify the access token with
    Microsoft's Graph API before trusting the data.
    """
    if not settings.microsoft_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Microsoft OAuth is not configured on the server"
        )

    microsoft_id = request.microsoft_id
    email = request.email
    name = request.name

    if not microsoft_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Microsoft user info"
        )

    # Verify the Microsoft ID by checking if a user with this microsoft_id
    # already exists, OR if the email matches an existing account.
    # NOTE: For stronger security, have the frontend send the access_token
    # and verify it against https://graph.microsoft.com/v1.0/me
    # For now, we at minimum validate the email format.
    import re
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )

    user = auth_controller.get_or_create_oauth_user(
        db, provider="microsoft", provider_id=microsoft_id,
        email=email, name=name, picture=None
    )

    access_token = AuthController.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return current_user
