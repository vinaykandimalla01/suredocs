"""
Shared pytest fixtures for SureDocs backend tests.

Tests run against the live development database using transactions
that are rolled back after each test to avoid side-effects.
"""

from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal, engine
from app.main import app
from app.models.user import AccountStatus, User, UserRole
from app.routers.auth import _reset_ip_rate_limit


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    """Reset the in-memory IP rate limiter before each test."""
    _reset_ip_rate_limit()
    yield
    _reset_ip_rate_limit()


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    """Provide a transactional database session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db: Session) -> TestClient:
    """FastAPI test client using the transactional session."""
    from app.db.session import get_db

    def _override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def active_admin(db: Session) -> User:
    """Create an active administrator account."""
    now = datetime.now(timezone.utc)
    user = User(
        full_name="Test Admin",
        email="testadmin@suredocs.example",
        password_hash=hash_password("SecureAdmin1!"),
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
        email_verified_at=now,
        created_at=now,
        updated_at=now,
        password_changed_at=now,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture()
def active_employee(db: Session, active_admin: User) -> User:
    """Create an active employee account."""
    now = datetime.now(timezone.utc)
    user = User(
        full_name="Test Employee",
        email="testemployee@suredocs.example",
        password_hash=hash_password("SecureEmp1!"),
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.ACTIVE,
        email_verified_at=now,
        created_at=now,
        updated_at=now,
        password_changed_at=now,
        created_by=active_admin.id,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture()
def pending_user(db: Session) -> User:
    """Create a pending (not yet activated) account."""
    now = datetime.now(timezone.utc)
    user = User(
        full_name="Pending User",
        email="pending@suredocs.example",
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.PENDING,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture()
def suspended_user(db: Session) -> User:
    """Create a suspended account."""
    now = datetime.now(timezone.utc)
    user = User(
        full_name="Suspended User",
        email="suspended@suredocs.example",
        password_hash=hash_password("SuspendedPass1!"),
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.SUSPENDED,
        email_verified_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture()
def disabled_user(db: Session) -> User:
    """Create a disabled account."""
    now = datetime.now(timezone.utc)
    user = User(
        full_name="Disabled User",
        email="disabled@suredocs.example",
        password_hash=hash_password("DisabledPass1!"),
        role=UserRole.EMPLOYEE,
        account_status=AccountStatus.DISABLED,
        email_verified_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()
    return user
