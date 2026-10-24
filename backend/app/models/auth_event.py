"""
AuthEvent model — immutable authentication event log for security auditing.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AuthEventType(str, enum.Enum):
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    SESSION_REVOKED = "SESSION_REVOKED"
    AUTH_REJECTED_INACTIVE = "AUTH_REJECTED_INACTIVE"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    MFA_ENABLED = "MFA_ENABLED"
    MFA_DISABLED = "MFA_DISABLED"
    MFA_REJECTED = "MFA_REJECTED"
    USER_ROLE_CHANGED = "USER_ROLE_CHANGED"
    USER_STATUS_CHANGED = "USER_STATUS_CHANGED"


class AuthEvent(Base):
    __tablename__ = "auth_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    # Nullable: failed logins against unknown emails may not have a user_id.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    event_type: Mapped[AuthEventType] = mapped_column(
        Enum(
            AuthEventType,
            name="auth_event_type",
            create_constraint=True,
            native_enum=False,
            length=30,
        ),
        nullable=False,
    )

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45), nullable=True,
    )

    user_agent: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )

    # Sanitized JSON metadata — never contains passwords, tokens, or secrets.
    details: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', "
            "'ACCOUNT_LOCKED', 'SESSION_REVOKED', 'AUTH_REJECTED_INACTIVE', "
            "'PASSWORD_CHANGED', 'MFA_ENABLED', 'MFA_DISABLED', 'MFA_REJECTED', "
            "'USER_ROLE_CHANGED', 'USER_STATUS_CHANGED')",
            name="ck_auth_events_event_type",
        ),
        Index("ix_auth_events_user_id", "user_id"),
        Index("ix_auth_events_event_type", "event_type"),
        Index("ix_auth_events_occurred_at", "occurred_at"),
    )

    def __repr__(self) -> str:
        return f"<AuthEvent id={self.id} type={self.event_type.value}>"
