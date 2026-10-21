"""
UserSession model — server-side session storage.

Only a cryptographic hash of the session token is stored; the raw
token is known only to the browser cookie.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # SHA-256 hash of the raw session token.
    session_token_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )

    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45), nullable=True,
    )

    user_agent: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )

    # Relationship back to User
    user: Mapped["User"] = relationship(
        "User", back_populates="sessions",
    )

    __table_args__ = (
        Index("ix_user_sessions_user_id", "user_id"),
        Index("ix_user_sessions_token_hash", "session_token_hash", unique=True),
        Index("ix_user_sessions_expires_at", "expires_at"),
    )

    def __repr__(self) -> str:
        return f"<UserSession id={self.id} user_id={self.user_id}>"


# Avoid circular import — used by relationship type hint.
from app.models.user import User  # noqa: E402, F811
