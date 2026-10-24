"""Persistent access requests, user preferences, notifications, and MFA methods."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    requester_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    requested_permissions: Mapped[dict[str, bool]] = mapped_column(
        JSONB, nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'PENDING'"),
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    decided_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    resulting_permission_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_permissions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED', 'EXPIRED')",
            name="ck_access_requests_status",
        ),
        CheckConstraint("length(btrim(reason)) > 0", name="ck_access_requests_reason_nonempty"),
        CheckConstraint(
            "jsonb_typeof(requested_permissions) = 'object' "
            "AND requested_permissions - ARRAY['can_view', 'can_download', 'can_edit']::text[] = '{}'::jsonb "
            "AND (NOT (requested_permissions ? 'can_view') OR jsonb_typeof(requested_permissions->'can_view') = 'boolean') "
            "AND (NOT (requested_permissions ? 'can_download') OR jsonb_typeof(requested_permissions->'can_download') = 'boolean') "
            "AND (NOT (requested_permissions ? 'can_edit') OR jsonb_typeof(requested_permissions->'can_edit') = 'boolean') "
            "AND (requested_permissions @> '{\"can_view\": true}'::jsonb "
            "OR requested_permissions @> '{\"can_download\": true}'::jsonb "
            "OR requested_permissions @> '{\"can_edit\": true}'::jsonb)",
            name="ck_access_requests_permissions_shape",
        ),
        CheckConstraint(
            "(decided_at IS NULL) = (decided_by_user_id IS NULL)",
            name="ck_access_requests_decision_actor_time",
        ),
        CheckConstraint(
            "status != 'APPROVED' OR resulting_permission_id IS NOT NULL",
            name="ck_access_requests_approved_has_grant",
        ),
        Index(
            "ix_access_requests_document_pending",
            "document_id", "requested_at",
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index("ix_access_requests_requester_requested", "requester_user_id", requested_at.desc()),
        Index(
            "uq_access_requests_pending_document_requester",
            "document_id", "requester_user_id", unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    __table_args__ = (
        CheckConstraint("jsonb_typeof(metadata) = 'object'", name="ck_notifications_metadata_object"),
        Index("ix_notifications_recipient_created", "recipient_user_id", created_at.desc()),
        Index(
            "ix_notifications_recipient_unread",
            "recipient_user_id", created_at.desc(),
            postgresql_where=text("read_at IS NULL"),
        ),
    )


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    notification_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"),
    )
    display_settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint("jsonb_typeof(notification_settings) = 'object'", name="ck_user_preferences_notifications_object"),
        CheckConstraint("jsonb_typeof(display_settings) = 'object'", name="ck_user_preferences_display_object"),
    )


class UserMfaMethod(Base):
    __tablename__ = "user_mfa_methods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    method_type: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'TOTP'"),
    )
    secret_ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"),
    )
    setup_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    last_used_counter: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "method_type", name="uq_user_mfa_methods_user_type"),
        CheckConstraint("method_type = 'TOTP'", name="ck_user_mfa_methods_type"),
        CheckConstraint("NOT is_enabled OR confirmed_at IS NOT NULL", name="ck_user_mfa_methods_enabled_confirmed"),
        Index("ix_user_mfa_methods_user_enabled", "user_id", "is_enabled"),
    )
