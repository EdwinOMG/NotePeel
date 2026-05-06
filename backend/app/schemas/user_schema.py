from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class UserResponse(BaseModel):
    """Schema for user response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    profile_picture: Optional[str] = None
    is_active: bool
    created_at: datetime
    subscription: str = "free"


class Token(BaseModel):
    """Schema for JWT token."""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Schema for token data."""
    user_id: Optional[int] = None
    email: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    """Schema for Google OAuth login."""
    credential: str


class MicrosoftAuthRequest(BaseModel):
    """Schema for Microsoft OAuth login (MSAL popup flow)."""
    microsoft_id: str
    email: str
    name: str
