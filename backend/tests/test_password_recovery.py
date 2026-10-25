from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_session_token, verify_password
from app.models.password_reset_token import PasswordResetToken
from app.models.user_session import UserSession
from app.routers import auth


def _configure_email(monkeypatch, sender=None):
    monkeypatch.setattr(auth, "ensure_password_reset_email_configured", lambda: None)
    if sender is not None:
        monkeypatch.setattr(auth, "send_password_reset_email", sender)


def test_forgot_password_returns_generic_response_and_stores_only_token_hash(
    client: TestClient,
    db: Session,
    active_admin,
    monkeypatch,
):
    sent = []
    _configure_email(monkeypatch, lambda email, token: sent.append((email, token)))

    response = client.post("/api/auth/forgot-password", json={"email": " TESTADMIN@suredocs.example "})

    assert response.status_code == 202
    assert response.json()["message"] == "If an account exists for this email, we’ll send reset instructions."
    assert len(sent) == 1
    assert sent[0][0] == active_admin.email
    token = db.execute(select(PasswordResetToken)).scalar_one()
    assert token.token_hash == hash_session_token(sent[0][1])
    assert sent[0][1] not in token.token_hash
    assert token.expires_at - token.created_at == timedelta(minutes=30)


def test_unknown_and_ineligible_users_receive_the_same_generic_response(
    client: TestClient,
    pending_user,
    suspended_user,
    monkeypatch,
):
    _configure_email(monkeypatch)

    responses = [
        client.post("/api/auth/forgot-password", json={"email": email})
        for email in (
            "missing@suredocs.example",
            pending_user.email,
            suspended_user.email,
        )
    ]

    assert all(response.status_code == 202 for response in responses)
    assert len({response.json()["message"] for response in responses}) == 1


def test_reset_password_changes_hash_revokes_sessions_and_rejects_replay(
    client: TestClient,
    db: Session,
    active_admin,
    monkeypatch,
):
    sent = []
    _configure_email(monkeypatch, lambda email, token: sent.append(token))
    db.add(UserSession(
        user_id=active_admin.id,
        session_token_hash=hash_session_token("existing-session-token"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    ))
    db.flush()
    old_hash = active_admin.password_hash

    requested = client.post(
        "/api/auth/forgot-password",
        json={"email": active_admin.email},
    )
    assert requested.status_code == 202
    token = sent[0]
    response = client.post(
        "/api/auth/reset-password",
        json={"token": token, "new_password": "NewSecurePassword1!"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Your password has been reset successfully."
    assert active_admin.password_hash != old_hash
    assert verify_password("NewSecurePassword1!", active_admin.password_hash)
    assert not verify_password("SecureAdmin1!", active_admin.password_hash)
    stored_session = db.execute(
        select(UserSession).where(UserSession.user_id == active_admin.id)
    ).scalar_one()
    assert stored_session.revoked_at is not None
    stored_token = db.execute(
        select(PasswordResetToken).where(PasswordResetToken.user_id == active_admin.id)
    ).scalar_one()
    assert stored_token.consumed_at is not None
    old_login = client.post(
        "/api/auth/login",
        json={"email": active_admin.email, "password": "SecureAdmin1!"},
    )
    new_login = client.post(
        "/api/auth/login",
        json={"email": active_admin.email, "password": "NewSecurePassword1!"},
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200
    replay = client.post(
        "/api/auth/reset-password",
        json={"token": token, "new_password": "AnotherSecurePassword1!"},
    )
    assert replay.status_code == 400


def test_expired_reset_token_is_rejected_without_changing_password(
    client: TestClient,
    db: Session,
    active_admin,
    monkeypatch,
):
    sent = []
    _configure_email(monkeypatch, lambda email, token: sent.append(token))
    client.post("/api/auth/forgot-password", json={"email": active_admin.email})
    active_admin_hash = active_admin.password_hash
    reset_token = db.execute(
        select(PasswordResetToken).where(PasswordResetToken.user_id == active_admin.id)
    ).scalar_one()
    reset_token.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.flush()

    response = client.post(
        "/api/auth/reset-password",
        json={"token": sent[0], "new_password": "NewSecurePassword1!"},
    )

    assert response.status_code == 400
    assert active_admin.password_hash == active_admin_hash


def test_password_reset_requests_are_rate_limited_by_ip(client: TestClient, monkeypatch):
    _configure_email(monkeypatch)
    responses = [
        client.post(
            "/api/auth/forgot-password",
            json={"email": "missing@suredocs.example"},
        )
        for _ in range(auth._PASSWORD_RESET_MAX_ATTEMPTS + 1)
    ]

    assert all(response.status_code == 202 for response in responses[:-1])
    assert responses[-1].status_code == 429


def test_missing_mail_configuration_fails_generically_before_account_lookup(
    client: TestClient,
    monkeypatch,
):
    def unavailable():
        raise auth.PasswordResetEmailConfigurationError("missing SMTP settings")

    monkeypatch.setattr(auth, "ensure_password_reset_email_configured", unavailable)
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "missing@suredocs.example"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == auth._PASSWORD_RESET_UNAVAILABLE_MESSAGE
    assert "SMTP settings" not in response.text


def test_invalid_reset_inputs_do_not_echo_submitted_secrets(client: TestClient):
    raw_password = "SensitiveSubmittedPassword!"
    raw_token = "invalid-but-sensitive-reset-token"
    response = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": raw_password},
    )

    assert response.status_code == 400
    assert raw_password not in response.text
    assert raw_token not in response.text
