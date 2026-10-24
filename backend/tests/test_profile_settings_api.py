"""Tests for employee Profile & Settings API endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.security import generate_session_token, hash_session_token
from app.models.user import User
from app.models.user_session import UserSession


def authenticate(client, db, user: User) -> None:
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


def test_profile_read_and_patch(client, db, active_employee):
    authenticate(client, db, active_employee)

    # 1. Read
    res = client.get("/api/users/me/profile")
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == active_employee.email
    assert "phone" in data
    assert "bio" in data

    # 2. Patch
    update_res = client.patch(
        "/api/users/me/profile",
        json={
            "full_name": "Pooja Gupta",
            "department": "Product",
            "job_title": "Product Analyst",
            "phone": "+91 98765 43210",
            "location": "Bangalore, India",
            "bio": "Product Analyst with a focus on data-driven insights and team collaboration.",
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["full_name"] == "Pooja Gupta"
    assert updated["department"] == "Product"
    assert updated["job_title"] == "Product Analyst"
    assert updated["phone"] == "+91 98765 43210"
    assert updated["location"] == "Bangalore, India"


def test_password_change_validation(client, db, active_employee):
    authenticate(client, db, active_employee)

    # Weak password
    res = client.post(
        "/api/users/me/password",
        json={
            "current_password": "WrongPassword123!",
            "new_password": "weak",
            "confirm_password": "weak",
        },
    )
    assert res.status_code == 400

    # Mismatched confirmation
    res2 = client.post(
        "/api/users/me/password",
        json={
            "current_password": "EmployeePassword123!",
            "new_password": "ValidPassword123!",
            "confirm_password": "DifferentPassword123!",
        },
    )
    assert res2.status_code == 400


def test_sessions_and_revocation(client, db, active_employee):
    authenticate(client, db, active_employee)

    res = client.get("/api/users/me/sessions")
    assert res.status_code == 200
    sessions = res.json()
    assert len(sessions) >= 1
    assert any(s["is_current"] for s in sessions)

    session_to_revoke = sessions[-1]["id"]
    del_res = client.delete(f"/api/users/me/sessions/{session_to_revoke}")
    assert del_res.status_code == 200


def test_notification_and_display_preferences(client, db, active_employee):
    authenticate(client, db, active_employee)

    # Notifications
    res = client.get("/api/users/me/notifications/preferences")
    assert res.status_code == 200
    notifs = res.json()
    assert notifs["document_access_requests"] is True

    update_notif = client.put(
        "/api/users/me/notifications/preferences",
        json={
            **notifs,
            "product_updates": True,
        },
    )
    assert update_notif.status_code == 200
    assert update_notif.json()["product_updates"] is True

    # Preferences
    res_pref = client.get("/api/users/me/preferences")
    assert res_pref.status_code == 200
    prefs = res_pref.json()
    assert prefs["appearance"] == "light"

    update_pref = client.put(
        "/api/users/me/preferences",
        json={
            **prefs,
            "default_view": "grid",
        },
    )
    assert update_pref.status_code == 200
    assert update_pref.json()["default_view"] == "grid"


def test_storage_and_integrations(client, db, active_employee):
    authenticate(client, db, active_employee)

    # Storage
    res = client.get("/api/users/me/storage")
    assert res.status_code == 200
    storage = res.json()
    assert storage["used_gb"] == 0.0
    assert storage["total_gb"] is None
    assert storage["available_gb"] is None
    assert storage["breakdown"] == []

    # Integrations
    res_int = client.get("/api/users/me/integrations")
    assert res_int.status_code == 200
    integrations = res_int.json()
    assert len(integrations) == 5

    assert all(item["connected"] is False for item in integrations)
    assert all(item["status"] == "Not configured" for item in integrations)

    # Unconfigured integrations fail clearly instead of persisting a fake connection.
    toggle_res = client.post("/api/users/me/integrations/google-drive/toggle")
    assert toggle_res.status_code == 501
    assert "has not been configured" in toggle_res.json()["detail"]
