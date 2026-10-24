from __future__ import annotations

from sqlalchemy import select
from fastapi.testclient import TestClient

from app.models.auth_event import AuthEvent, AuthEventType
from app.models.user import AccountStatus, User, UserRole
from app.models.user_session import UserSession


def _login(client: TestClient, email: str, password: str):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def test_admin_update_persists_role_and_profile_fields_with_audit(
    client: TestClient,
    db,
    active_admin,
    active_employee,
) -> None:
    _login(client, active_admin.email, "SecureAdmin1!")
    updated = client.patch(
        f"/api/admin/users/{active_employee.id}",
        json={"role": "MANAGER", "department": "Risk", "job_title": "Reviewer"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["role"] == "MANAGER"
    assert updated.json()["department"] == "Risk"
    assert active_employee.role == UserRole.MANAGER

    role_event = db.execute(
        select(AuthEvent).where(
            AuthEvent.user_id == active_employee.id,
            AuthEvent.event_type == AuthEventType.USER_ROLE_CHANGED,
        )
    ).scalar_one()
    assert role_event.details == {
        "actor_user_id": str(active_admin.id),
        "before": "EMPLOYEE",
        "after": "MANAGER",
    }


def test_deactivation_revokes_existing_sessions_and_records_events(
    client: TestClient,
    db,
    active_admin,
    active_employee,
) -> None:
    employee_login = _login(client, active_employee.email, "SecureEmp1!")
    employee_token = employee_login.cookies["suredocs_session"]
    employee_session = db.execute(
        select(UserSession).where(UserSession.user_id == active_employee.id)
    ).scalar_one()

    _login(client, active_admin.email, "SecureAdmin1!")
    disabled = client.patch(
        f"/api/admin/users/{active_employee.id}",
        json={"account_status": "DISABLED"},
    )
    assert disabled.status_code == 200, disabled.text
    db.refresh(employee_session)
    assert employee_session.revoked_at is not None
    assert active_employee.account_status == AccountStatus.DISABLED
    assert db.execute(
        select(AuthEvent).where(
            AuthEvent.user_id == active_employee.id,
            AuthEvent.event_type == AuthEventType.USER_STATUS_CHANGED,
        )
    ).scalar_one_or_none() is not None
    assert db.execute(
        select(AuthEvent).where(
            AuthEvent.user_id == active_employee.id,
            AuthEvent.event_type == AuthEventType.SESSION_REVOKED,
        )
    ).scalar_one_or_none() is not None

    client.cookies.set("suredocs_session", employee_token)
    assert client.get("/api/auth/me").status_code == 401


def test_admin_cannot_activate_unverified_user_or_remove_last_active_admin(
    client: TestClient,
    db,
    active_admin,
    pending_user,
) -> None:
    _login(client, active_admin.email, "SecureAdmin1!")
    unverified = client.patch(
        f"/api/admin/users/{pending_user.id}", json={"account_status": "ACTIVE"}
    )
    assert unverified.status_code == 409
    assert "Verify the user's email" in unverified.json()["detail"]

    for other_admin in db.execute(
        select(User).where(
            User.role == UserRole.ADMIN,
            User.account_status == AccountStatus.ACTIVE,
            User.id != active_admin.id,
        )
    ).scalars():
        other_admin.account_status = AccountStatus.DISABLED
    db.flush()
    last_admin = client.patch(
        f"/api/admin/users/{active_admin.id}", json={"account_status": "DISABLED"}
    )
    assert last_admin.status_code == 409
    assert "last active administrator" in last_admin.json()["detail"]
