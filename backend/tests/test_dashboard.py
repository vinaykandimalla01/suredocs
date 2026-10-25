"""Authorization and query-shape tests for the admin dashboard summary."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.main import app
from app.models.user import AccountStatus, User, UserRole


class FakeResult:
    def one(self):
        return (124, 110, 14, 482)

    def all(self):
        return []


class FakeSession:
    def __init__(self):
        self.statements = []

    def execute(self, statement):
        self.statements.append(statement)
        return FakeResult()

    def scalar(self, statement):
        self.statements.append(statement)
        return 482


def make_user(role: UserRole) -> User:
    return User(
        full_name="Dashboard Test User",
        email="dashboard-test@example.test",
        password_hash="must-not-be-returned",
        role=role,
        account_status=AccountStatus.ACTIVE,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_dashboard_summary_requires_an_administrator():
    app.dependency_overrides.clear()
    try:
        with TestClient(app) as client:
            for path in (
                "/api/admin/dashboard/summary",
                "/api/admin/dashboard/storage",
                "/api/admin/dashboard/denied-requests",
                "/api/admin/dashboard/operations",
            ):
                assert client.get(path).status_code == 401

            employee = make_user(UserRole.EMPLOYEE)
            app.dependency_overrides[get_current_user] = lambda: employee
            for path in (
                "/api/admin/dashboard/summary",
                "/api/admin/dashboard/storage",
                "/api/admin/dashboard/denied-requests",
                "/api/admin/dashboard/operations",
            ):
                assert client.get(path).status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_dashboard_summary_returns_only_count_metrics_and_excludes_deleted_docs():
    fake_db = FakeSession()

    def authenticated_admin():
        return make_user(UserRole.ADMIN)

    def dashboard_db():
        yield fake_db

    app.dependency_overrides.clear()
    app.dependency_overrides[get_current_user] = authenticated_admin
    app.dependency_overrides[get_db] = dashboard_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/admin/dashboard/summary?days=7")

        assert response.status_code == 200
        payload = response.json()
        assert payload["users"] == {"total": 124, "active": 110, "disabled": 14}
        assert payload["documents"] == {"total": 482}
        assert payload["period_days"] == 7
        assert payload["trends"]["users"]["change"] == 0
        assert payload["trends"]["users"]["points"] == [124] * 7
        assert payload["trends"]["documents"]["points"] == [482] * 7
        assert "password_hash" not in response.text
        assert "session_token_hash" not in response.text

        sql_statements = [
            str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
            for statement in fake_db.statements
        ]
        sql = "\n".join(sql_statements)
        assert "users.account_status = 'ACTIVE'" in sql
        assert "users.account_status = 'DISABLED'" in sql
        assert "documents.status != 'DELETED'" in sql
    finally:
        app.dependency_overrides.clear()
