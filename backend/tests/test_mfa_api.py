from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.core.security import generate_session_token, hash_session_token
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.persistence import UserMfaMethod
from app.models.user import User
from app.models.user_session import UserSession
from app.services.mfa import _totp, totp_counter_at


def _authenticate(client: TestClient, db: Session, user: User) -> None:
    token = generate_session_token()
    now = datetime.now(timezone.utc)
    db.add(
        UserSession(
            user_id=user.id,
            session_token_hash=hash_session_token(token),
            created_at=now,
            expires_at=now + timedelta(hours=1),
        )
    )
    db.flush()
    client.cookies.set("suredocs_session", token)


def test_totp_setup_confirmation_login_and_replay_protection(
    client: TestClient,
    db: Session,
    active_employee: User,
    monkeypatch,
) -> None:
    prefix = b"test-kms-ciphertext:"
    monkeypatch.setattr(
        "app.routers.users.encrypt_totp_secret",
        lambda secret: prefix + secret.encode("ascii"),
    )
    monkeypatch.setattr(
        "app.routers.users.decrypt_totp_secret",
        lambda ciphertext: ciphertext.removeprefix(prefix).decode("ascii"),
    )
    monkeypatch.setattr(
        "app.routers.auth.decrypt_totp_secret",
        lambda ciphertext: ciphertext.removeprefix(prefix).decode("ascii"),
    )
    _authenticate(client, db, active_employee)

    wrong_password = client.post(
        "/api/users/me/2fa/setup", json={"current_password": "incorrect"}
    )
    assert wrong_password.status_code == 400
    setup = client.post(
        "/api/users/me/2fa/setup", json={"current_password": "SecureEmp1!"}
    )
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_url"].startswith("otpauth://totp/")
    method = db.execute(
        select(UserMfaMethod).where(UserMfaMethod.user_id == active_employee.id)
    ).scalar_one()
    assert method.secret_ciphertext != secret.encode("ascii")
    assert method.is_enabled is False

    setup_code = _totp(secret, totp_counter_at())
    confirmed = client.post("/api/users/me/2fa/confirm", json={"code": setup_code})
    assert confirmed.status_code == 200, confirmed.text
    db.refresh(method)
    assert method.is_enabled is True
    assert method.confirmed_at is not None
    assert method.last_used_counter is not None
    assert db.execute(
        select(AuthEvent).where(
            AuthEvent.user_id == active_employee.id,
            AuthEvent.event_type == AuthEventType.MFA_ENABLED,
        )
    ).scalar_one_or_none() is not None

    client.post("/api/auth/logout")
    no_code = client.post(
        "/api/auth/login",
        json={"email": active_employee.email, "password": "SecureEmp1!"},
    )
    assert no_code.status_code == 401
    assert no_code.json()["detail"] == "Authenticator code required or invalid."

    login_code = _totp(secret, method.last_used_counter + 1)
    login = client.post(
        "/api/auth/login",
        json={
            "email": active_employee.email,
            "password": "SecureEmp1!",
            "totp_code": login_code,
        },
    )
    assert login.status_code == 200, login.text
    replay = client.post(
        "/api/auth/login",
        json={
            "email": active_employee.email,
            "password": "SecureEmp1!",
            "totp_code": login_code,
        },
    )
    assert replay.status_code == 401
    assert db.execute(
        select(AuthEvent).where(
            AuthEvent.user_id == active_employee.id,
            AuthEvent.event_type == AuthEventType.MFA_REJECTED,
        )
    ).first() is not None
