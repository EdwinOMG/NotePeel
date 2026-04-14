"""
Tests for AuthController and auth routes.
Run with: pytest tests/backend/test_auth.py -v
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import timedelta
import jwt

from app.controllers.auth_controller import AuthController
from app.models.user import User
from app.schemas.user_schema import UserCreate


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def db():
    return MagicMock()

@pytest.fixture
def sample_user():
    user = User()
    user.id = 1
    user.email = "test@example.com"
    user.username = "testuser"
    user.hashed_password = AuthController.hash_password("password123")
    user.is_active = True
    return user


# ── Password Hashing ──────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_password_returns_string(self):
        hashed = AuthController.hash_password("mypassword")
        assert isinstance(hashed, str)

    def test_hash_is_not_plaintext(self):
        hashed = AuthController.hash_password("mypassword")
        assert hashed != "mypassword"

    def test_verify_correct_password(self):
        hashed = AuthController.hash_password("mypassword")
        assert AuthController.verify_password("mypassword", hashed) is True

    def test_verify_wrong_password(self):
        hashed = AuthController.hash_password("mypassword")
        assert AuthController.verify_password("wrongpassword", hashed) is False

    def test_same_password_produces_different_hashes(self):
        hash1 = AuthController.hash_password("mypassword")
        hash2 = AuthController.hash_password("mypassword")
        assert hash1 != hash2  # bcrypt uses random salt


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
        from fastapi import HTTPException
        token = AuthController.create_access_token(
            {"sub": "1"},
            expires_delta=timedelta(seconds=-1)  # already expired
        )
        with pytest.raises(HTTPException) as exc:
            AuthController.decode_token(token)
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail.lower()

    def test_decode_invalid_token_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            AuthController.decode_token("this.is.not.valid")
        assert exc.value.status_code == 401

    def test_decode_tampered_token_raises(self):
        from fastapi import HTTPException
        token = AuthController.create_access_token({"sub": "1"})
        tampered = token + "tampered"
        with pytest.raises(HTTPException):
            AuthController.decode_token(tampered)


# ── User Lookup ───────────────────────────────────────────────────────────────

class TestUserLookup:
    def test_get_user_by_email_found(self, db, sample_user):
        db.query.return_value.filter.return_value.first.return_value = sample_user
        result = AuthController.get_user_by_email(db, "test@example.com")
        assert result == sample_user

    def test_get_user_by_email_not_found(self, db):
        db.query.return_value.filter.return_value.first.return_value = None
        result = AuthController.get_user_by_email(db, "nobody@example.com")
        assert result is None

    def test_get_user_by_id_found(self, db, sample_user):
        db.query.return_value.filter.return_value.first.return_value = sample_user
        result = AuthController.get_user_by_id(db, 1)
        assert result == sample_user

    def test_get_user_by_id_not_found(self, db):
        db.query.return_value.filter.return_value.first.return_value = None
        result = AuthController.get_user_by_id(db, 999)
        assert result is None


# ── User Creation ─────────────────────────────────────────────────────────────

class TestUserCreation:
    def test_create_user_success(self, db):
        # No existing user
        db.query.return_value.filter.return_value.first.return_value = None

        created_user = User()
        created_user.id = 1
        created_user.email = "new@example.com"
        created_user.username = "newuser"

        db.refresh.side_effect = lambda u: None

        user_data = UserCreate(
            email="new@example.com",
            username="newuser",
            password="password123"
        )

        with patch.object(AuthController, 'get_user_by_email', return_value=None):
            with patch.object(db, 'query') as mock_query:
                mock_query.return_value.filter.return_value.first.return_value = None
                db.refresh.side_effect = lambda u: setattr(u, 'id', 1)
                result = AuthController.create_user(db, user_data)
                assert db.add.called
                assert db.commit.called

    def test_create_user_duplicate_email_raises(self, db, sample_user):
        from fastapi import HTTPException
        with patch.object(AuthController, 'get_user_by_email', return_value=sample_user):
            user_data = UserCreate(
                email="test@example.com",
                username="newuser",
                password="password123"
            )
            with pytest.raises(HTTPException) as exc:
                AuthController.create_user(db, user_data)
            assert exc.value.status_code == 400
            assert "email" in exc.value.detail.lower()

    def test_create_user_duplicate_username_raises(self, db, sample_user):
        from fastapi import HTTPException
        with patch.object(AuthController, 'get_user_by_email', return_value=None):
            db.query.return_value.filter.return_value.first.return_value = sample_user
            user_data = UserCreate(
                email="unique@example.com",
                username="testuser",
                password="password123"
            )
            with pytest.raises(HTTPException) as exc:
                AuthController.create_user(db, user_data)
            assert exc.value.status_code == 400
            assert "username" in exc.value.detail.lower()


# ── Authentication ────────────────────────────────────────────────────────────

class TestAuthentication:
    def test_authenticate_user_correct_credentials(self, db, sample_user):
        with patch.object(AuthController, 'get_user_by_email', return_value=sample_user):
            result = AuthController.authenticate_user(db, "test@example.com", "password123")
            assert result == sample_user

    def test_authenticate_user_wrong_password(self, db, sample_user):
        with patch.object(AuthController, 'get_user_by_email', return_value=sample_user):
            result = AuthController.authenticate_user(db, "test@example.com", "wrongpassword")
            assert result is None

    def test_authenticate_user_not_found(self, db):
        with patch.object(AuthController, 'get_user_by_email', return_value=None):
            result = AuthController.authenticate_user(db, "nobody@example.com", "password123")
            assert result is None

    def test_login_success_returns_token(self, db, sample_user):
        with patch.object(AuthController, 'authenticate_user', return_value=sample_user):
            token = AuthController.login(db, "test@example.com", "password123")
            assert token.token_type == "bearer"
            assert isinstance(token.access_token, str)

    def test_login_wrong_credentials_raises(self, db):
        from fastapi import HTTPException
        with patch.object(AuthController, 'authenticate_user', return_value=None):
            with pytest.raises(HTTPException) as exc:
                AuthController.login(db, "test@example.com", "wrongpassword")
            assert exc.value.status_code == 401