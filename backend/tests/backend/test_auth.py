"""
Tests for AuthController (Google + Microsoft OAuth).
Run with: pytest tests/backend/test_auth.py -v
"""
import pytest
from unittest.mock import MagicMock
from datetime import timedelta
from fastapi import HTTPException

from app.controllers.auth_controller import AuthController
from app.models.user import User


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def db():
    return MagicMock()

@pytest.fixture
def google_user():
    user = User()
    user.id = 1
    user.email = "test@gmail.com"
    user.username = "testuser"
    user.google_id = "google_123456"
    user.microsoft_id = None
    user.profile_picture = "https://lh3.googleusercontent.com/photo.jpg"
    user.is_active = True
    return user

@pytest.fixture
def microsoft_user():
    user = User()
    user.id = 2
    user.email = "test@outlook.com"
    user.username = "msuser"
    user.google_id = None
    user.microsoft_id = "ms_abcdef"
    user.profile_picture = None
    user.is_active = True
    return user


# ── JWT Tokens ────────────────────────────────────────────────────────────────

class TestJWTTokens:
    def test_create_access_token_returns_string(self):
        token = AuthController.create_access_token({"sub": "1", "email": "test@example.com"})
        assert isinstance(token, str)

    def test_decode_valid_token(self):
        token = AuthController.create_access_token({"sub": "1", "email": "test@example.com"})
        payload = AuthController.decode_token(token)
        assert payload["sub"] == "1"
        assert payload["email"] == "test@example.com"

    def test_decode_expired_token_raises(self):
        token = AuthController.create_access_token(
            {"sub": "1"},
            expires_delta=timedelta(seconds=-1)
        )
        with pytest.raises(HTTPException) as exc:
            AuthController.decode_token(token)
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail.lower()

    def test_decode_invalid_token_raises(self):
        with pytest.raises(HTTPException) as exc:
            AuthController.decode_token("this.is.not.valid")
        assert exc.value.status_code == 401

    def test_decode_tampered_token_raises(self):
        token = AuthController.create_access_token({"sub": "1"})
        tampered = token + "tampered"
        with pytest.raises(HTTPException):
            AuthController.decode_token(tampered)


# ── User Lookup ───────────────────────────────────────────────────────────────

class TestUserLookup:
    def test_get_user_by_email_found(self, db, google_user):
        db.query.return_value.filter.return_value.first.return_value = google_user
        result = AuthController.get_user_by_email(db, "test@gmail.com")
        assert result == google_user

    def test_get_user_by_email_not_found(self, db):
        db.query.return_value.filter.return_value.first.return_value = None
        result = AuthController.get_user_by_email(db, "nobody@example.com")
        assert result is None

    def test_get_user_by_id_found(self, db, google_user):
        db.query.return_value.filter.return_value.first.return_value = google_user
        result = AuthController.get_user_by_id(db, 1)
        assert result == google_user

    def test_get_user_by_id_not_found(self, db):
        db.query.return_value.filter.return_value.first.return_value = None
        result = AuthController.get_user_by_id(db, 999)
        assert result is None


# ── OAuth User Creation ───────────────────────────────────────────────────────

class TestGetOrCreateOAuthUser:
    def test_existing_google_user_by_provider_id(self, db, google_user):
        """If user exists with matching google_id, return them."""
        db.query.return_value.filter.return_value.first.return_value = google_user
        result = AuthController.get_or_create_oauth_user(
            db, provider="google", provider_id="google_123456",
            email="test@gmail.com", name="Test User"
        )
        assert result == google_user
        assert not db.add.called

    def test_existing_microsoft_user_by_provider_id(self, db, microsoft_user):
        """If user exists with matching microsoft_id, return them."""
        db.query.return_value.filter.return_value.first.return_value = microsoft_user
        result = AuthController.get_or_create_oauth_user(
            db, provider="microsoft", provider_id="ms_abcdef",
            email="test@outlook.com", name="MS User"
        )
        assert result == microsoft_user
        assert not db.add.called

    def test_new_google_user_created(self, db):
        """If no user exists, create a new Google user."""
        db.query.return_value.filter.return_value.first.return_value = None
        db.refresh.side_effect = lambda u: setattr(u, 'id', 1)

        result = AuthController.get_or_create_oauth_user(
            db, provider="google", provider_id="new_google_id",
            email="new@gmail.com", name="New User",
            picture="https://photo.url/pic.jpg"
        )
        assert db.add.called
        assert db.commit.called
        assert result.email == "new@gmail.com"
        assert result.google_id == "new_google_id"
        assert result.profile_picture == "https://photo.url/pic.jpg"

    def test_new_microsoft_user_created(self, db):
        """If no user exists, create a new Microsoft user."""
        db.query.return_value.filter.return_value.first.return_value = None
        db.refresh.side_effect = lambda u: setattr(u, 'id', 2)

        result = AuthController.get_or_create_oauth_user(
            db, provider="microsoft", provider_id="new_ms_id",
            email="new@outlook.com", name="New MS User"
        )
        assert db.add.called
        assert db.commit.called
        assert result.email == "new@outlook.com"
        assert result.microsoft_id == "new_ms_id"

    def test_username_derived_from_name(self, db):
        """Username should be derived from the provider name."""
        db.query.return_value.filter.return_value.first.return_value = None
        db.refresh.side_effect = lambda u: setattr(u, 'id', 1)

        result = AuthController.get_or_create_oauth_user(
            db, provider="google", provider_id="gid",
            email="john@example.com", name="John Doe"
        )
        assert result.username == "john_doe"
