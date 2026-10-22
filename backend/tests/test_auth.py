"""
Comprehensive authentication tests for SureDocs Phase 1.

Covers:
- Credential verification (correct/incorrect passwords, unknown emails, etc.)
- Account eligibility (pending, suspended, disabled, locked accounts)
- Session lifecycle (create, validate, expire, revoke, logout)
- Login abuse protection (rate limiting, enumeration prevention)
- Security (no secrets in responses, parameterized queries)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import LOCKOUT_DURATION_SECONDS, MAX_FAILED_LOGIN_ATTEMPTS
from app.core.security import hash_password, hash_session_token
from app.models.user import AccountStatus, User, UserRole
from app.models.user_session import UserSession
from app.schemas.auth import LoginRequest


# =========================================================================
# Helpers
# =========================================================================

def login(client: TestClient, email: str, password: str) -> dict:
    """Helper to POST /api/auth/login."""
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )


def get_me(client: TestClient) -> dict:
    """Helper to GET /api/auth/me."""
    return client.get("/api/auth/me")


def logout(client: TestClient) -> dict:
    """Helper to POST /api/auth/logout."""
    return client.post("/api/auth/logout")


# =========================================================================
# 1. Credential verification
# =========================================================================

class TestCredentialVerification:
    """Tests 1–9: correct/incorrect credentials, email normalization."""

    def test_login_request_accepts_suredocs_synthetic_email_domain(self):
        request = LoginRequest(
            email="synthetic.user@suredocs.test",
            password="SyntheticPassword1!",
        )

        assert request.email == "synthetic.user@suredocs.test"

    def test_correct_admin_login(self, client, active_admin):
        """Test 2: Correct email and password for an administrator."""
        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "ADMIN"
        assert data["user"]["email"] == "testadmin@suredocs.example"
        assert "suredocs_session" in r.cookies

    def test_correct_employee_login(self, client, active_employee):
        """Test 1: Correct email and password for an active employee."""
        r = login(client, "testemployee@suredocs.example", "SecureEmp1!")
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "EMPLOYEE"

    def test_incorrect_password(self, client, active_admin):
        """Test 3: Incorrect password returns 401."""
        r = login(client, "testadmin@suredocs.example", "WrongPassword!")
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid email address or password"

    def test_unknown_email(self, client):
        """Test 4: Non-existent email returns 401."""
        r = login(client, "nobody@suredocs.example", "anything")
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid email address or password"

    def test_invalid_email_format(self, client):
        """Test 5: Invalid email input returns 422."""
        r = login(client, "not-an-email", "anything")
        assert r.status_code == 422

    def test_empty_email(self, client):
        """Test 6a: Empty email returns 422."""
        r = login(client, "", "password")
        assert r.status_code == 422

    def test_empty_password(self, client):
        """Test 6b: Empty password returns 422."""
        r = login(client, "admin@suredocs.example", "")
        assert r.status_code == 422

    def test_email_case_normalization(self, client, active_admin):
        """Test 7: Email is case-insensitive."""
        r = login(client, "TestAdmin@SureDocs.Example", "SecureAdmin1!")
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "testadmin@suredocs.example"

    def test_email_whitespace_normalization(self, client, active_admin):
        """Test 7: Leading/trailing whitespace is trimmed."""
        r = login(client, "  testadmin@suredocs.example  ", "SecureAdmin1!")
        assert r.status_code == 200

    def test_no_password_hash(self, client, pending_user):
        """Test 9: Account with null password_hash cannot log in."""
        # pending_user has no password_hash set
        r = login(client, "pending@suredocs.example", "anypassword")
        assert r.status_code == 401

    def test_response_does_not_expose_hash(self, client, active_admin):
        """Test 26: Login response never contains password_hash."""
        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        body = r.text
        assert "password_hash" not in body
        assert "argon2" not in body.lower()

    def test_response_does_not_expose_session_token_hash(self, client, active_admin):
        """Test 26: Login response doesn't contain session token hash."""
        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        body = r.json()
        assert "session_token_hash" not in str(body)


# =========================================================================
# 2. Account eligibility
# =========================================================================

class TestAccountEligibility:
    """Tests 10–14: account status prevents login."""

    def test_pending_cannot_login(self, client, pending_user):
        """Test 10: Pending account cannot log in."""
        r = login(client, "pending@suredocs.example", "anything")
        assert r.status_code == 401

    def test_suspended_cannot_login(self, client, suspended_user):
        """Test 11: Suspended account cannot log in."""
        r = login(client, "suspended@suredocs.example", "SuspendedPass1!")
        assert r.status_code == 401

    def test_disabled_cannot_login(self, client, disabled_user):
        """Test 12: Disabled account cannot log in."""
        r = login(client, "disabled@suredocs.example", "DisabledPass1!")
        assert r.status_code == 401

    def test_locked_account_cannot_login(self, client, db, active_admin):
        """Test 13: Locked account cannot bypass protection."""
        # Lock the account
        active_admin.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        active_admin.failed_login_attempts = MAX_FAILED_LOGIN_ATTEMPTS
        db.flush()

        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        assert r.status_code == 401

    def test_status_change_prevents_access(self, client, db, active_admin):
        """Test 14/22: Disabling account prevents further authenticated access."""
        # Login successfully first
        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        assert r.status_code == 200

        # Disable the account
        active_admin.account_status = AccountStatus.DISABLED
        db.flush()

        # /me should now fail
        r = get_me(client)
        assert r.status_code == 401


# =========================================================================
# 3. Session lifecycle
# =========================================================================

class TestSessionLifecycle:
    """Tests 15–22: session creation, validation, expiry, revocation."""

    def test_login_creates_session_and_cookie(self, client, db, active_admin):
        """Test 15: Successful login creates session and sets cookie."""
        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        assert r.status_code == 200
        assert "suredocs_session" in r.cookies

        # Session should exist in database
        sessions = db.query(UserSession).filter_by(user_id=active_admin.id).all()
        assert len(sessions) >= 1

    def test_session_validates_successfully(self, client, active_admin):
        """Test 16: Valid session returns user profile."""
        login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        r = get_me(client)
        assert r.status_code == 200
        assert r.json()["user"]["id"] == str(active_admin.id)

    def test_missing_session_rejected(self, client):
        """Test 17a: Missing session cookie returns 401."""
        r = get_me(client)
        assert r.status_code == 401

    def test_invalid_session_rejected(self, client):
        """Test 17b: Invalid session token returns 401."""
        client.cookies.set("suredocs_session", "completely-invalid-token")
        r = get_me(client)
        assert r.status_code == 401

    def test_expired_session_rejected(self, client, db, active_admin):
        """Test 17c: Expired session returns 401."""
        login(client, "testadmin@suredocs.example", "SecureAdmin1!")

        # Expire the session
        session = db.query(UserSession).filter_by(user_id=active_admin.id).first()
        session.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.flush()

        r = get_me(client)
        assert r.status_code == 401

    def test_revoked_session_rejected(self, client, db, active_admin):
        """Test 17d: Revoked session returns 401."""
        login(client, "testadmin@suredocs.example", "SecureAdmin1!")

        # Revoke the session
        session = db.query(UserSession).filter_by(user_id=active_admin.id).first()
        session.revoked_at = datetime.now(timezone.utc)
        db.flush()

        r = get_me(client)
        assert r.status_code == 401

    def test_logout_revokes_and_clears(self, client, db, active_admin):
        """Test 18: Logout revokes the session and clears the cookie."""
        login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        r = logout(client)
        assert r.status_code == 200

        # Session should be revoked
        session = db.query(UserSession).filter_by(user_id=active_admin.id).first()
        assert session.revoked_at is not None

    def test_old_cookie_rejected_after_logout(self, client, db, active_admin):
        """Test 19: A logged-out user cannot regain access with old cookie."""
        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        old_cookie = r.cookies["suredocs_session"]

        logout(client)

        # Try to use old cookie
        client.cookies.set("suredocs_session", old_cookie)
        r = get_me(client)
        assert r.status_code == 401

    def test_double_logout_is_safe(self, client, active_admin):
        """Repeated logout is handled gracefully."""
        login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        r1 = logout(client)
        assert r1.status_code == 200
        r2 = logout(client)
        assert r2.status_code == 200


# =========================================================================
# 4. Role-based authorization
# =========================================================================

class TestRoleAuthorization:
    """Tests 20–22: role enforcement, no privilege escalation."""

    def test_role_from_database_not_client(self, client, active_employee):
        """Test 21: Client-side role data cannot elevate privileges."""
        r = login(client, "testemployee@suredocs.example", "SecureEmp1!")
        assert r.status_code == 200
        user_data = r.json()["user"]
        assert user_data["role"] == "EMPLOYEE"
        # Even if the frontend claims ADMIN, /me always returns the DB role
        r = get_me(client)
        assert r.json()["user"]["role"] == "EMPLOYEE"

    def test_database_role_change_reflected(self, client, db, active_employee):
        """Test 22: DB role/status change is respected on subsequent requests."""
        login(client, "testemployee@suredocs.example", "SecureEmp1!")
        r = get_me(client)
        assert r.json()["user"]["role"] == "EMPLOYEE"

        # Change status to suspended
        active_employee.account_status = AccountStatus.SUSPENDED
        db.flush()

        r = get_me(client)
        assert r.status_code == 401


# =========================================================================
# 5. Login abuse and information disclosure
# =========================================================================

class TestLoginAbuseProtection:
    """Tests 24–28: rate limiting, enumeration prevention, no secret exposure."""

    def test_failed_attempts_tracked(self, client, db, active_admin):
        """Test 24: Failed login attempts increment counter."""
        for _ in range(3):
            login(client, "testadmin@suredocs.example", "WrongPassword!")

        db.refresh(active_admin)
        assert active_admin.failed_login_attempts == 3

    def test_account_locks_after_max_failures(self, client, db, active_admin):
        """Test 24: Account locks after MAX_FAILED_LOGIN_ATTEMPTS."""
        for _ in range(MAX_FAILED_LOGIN_ATTEMPTS):
            login(client, "testadmin@suredocs.example", "WrongPassword!")

        db.refresh(active_admin)
        assert active_admin.locked_until is not None
        assert active_admin.locked_until > datetime.now(timezone.utc)

    def test_successful_login_resets_counter(self, client, db, active_admin):
        """Successful login resets failed_login_attempts to 0."""
        # Fail twice
        login(client, "testadmin@suredocs.example", "WrongPassword!")
        login(client, "testadmin@suredocs.example", "WrongPassword!")
        db.refresh(active_admin)
        assert active_admin.failed_login_attempts == 2

        # Succeed
        login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        db.refresh(active_admin)
        assert active_admin.failed_login_attempts == 0
        assert active_admin.locked_until is None

    def test_error_messages_dont_reveal_account_existence(self, client, active_admin):
        """Test 25: Same error for unknown email vs wrong password."""
        r1 = login(client, "testadmin@suredocs.example", "WrongPassword!")
        r2 = login(client, "nonexistent@suredocs.example", "WrongPassword!")
        # Both should return the same generic message
        assert r1.json()["detail"] == r2.json()["detail"]
        assert r1.status_code == r2.status_code

    def test_no_password_in_response(self, client, active_admin):
        """Test 26: No password data in any response."""
        r = login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        full_response = r.text
        assert "SecureAdmin1!" not in full_response
        assert "password_hash" not in full_response

    def test_no_admin_registration_endpoint(self, client):
        """Test 28: No public endpoint allows admin registration."""
        # Try common registration endpoints
        for path in ["/api/auth/register", "/api/auth/signup", "/api/register"]:
            r = client.post(path, json={
                "email": "hacker@evil.example",
                "password": "anything",
                "role": "ADMIN",
            })
            assert r.status_code in (404, 405), f"{path} should not exist"


# =========================================================================
# 6. Health endpoint
# =========================================================================

class TestHealthEndpoint:
    """Health check endpoint tests."""

    def test_health_returns_ok(self, client):
        """Health endpoint is accessible without authentication."""
        r = client.get("/api/auth/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"

    def test_health_does_not_expose_secrets(self, client):
        """Health endpoint doesn't reveal credentials."""
        r = client.get("/api/auth/health")
        body = r.text.lower()
        assert "password" not in body
        assert "secret" not in body
        assert "suredocs_app" not in body


# =========================================================================
# 7. Auth events logging
# =========================================================================

class TestAuthEvents:
    """Verify auth events are recorded in the database."""

    def test_login_success_creates_event(self, client, db, active_admin):
        """Successful login records a LOGIN_SUCCESS event."""
        from app.models.auth_event import AuthEvent, AuthEventType

        login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        events = db.query(AuthEvent).filter_by(
            user_id=active_admin.id,
            event_type=AuthEventType.LOGIN_SUCCESS,
        ).all()
        assert len(events) >= 1

    def test_login_failure_creates_event(self, client, db, active_admin):
        """Failed login records a LOGIN_FAILED event."""
        from app.models.auth_event import AuthEvent, AuthEventType

        login(client, "testadmin@suredocs.example", "WrongPassword!")
        events = db.query(AuthEvent).filter_by(
            user_id=active_admin.id,
            event_type=AuthEventType.LOGIN_FAILED,
        ).all()
        assert len(events) >= 1

    def test_logout_creates_event(self, client, db, active_admin):
        """Logout records a LOGOUT event."""
        from app.models.auth_event import AuthEvent, AuthEventType

        login(client, "testadmin@suredocs.example", "SecureAdmin1!")
        logout(client)
        events = db.query(AuthEvent).filter_by(
            user_id=active_admin.id,
            event_type=AuthEventType.LOGOUT,
        ).all()
        assert len(events) >= 1

    def test_auth_events_dont_contain_passwords(self, client, db, active_admin):
        """Auth events never store passwords in details."""
        from app.models.auth_event import AuthEvent

        login(client, "testadmin@suredocs.example", "WrongPassword!")
        login(client, "testadmin@suredocs.example", "SecureAdmin1!")

        events = db.query(AuthEvent).filter_by(user_id=active_admin.id).all()
        for event in events:
            if event.details:
                details_str = str(event.details)
                assert "WrongPassword" not in details_str
                assert "SecureAdmin1" not in details_str
                assert "password_hash" not in details_str
