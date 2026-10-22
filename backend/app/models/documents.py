"""Document metadata, immutable versions, grants, and document audit history."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    classification: Mapped[str] = mapped_column(String(20), nullable=False)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'ACTIVE'"),
    )
    custom_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    deleted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    owner: Mapped[User] = relationship(
        "User", back_populates="owned_documents", foreign_keys=[owner_user_id],
    )
    creator: Mapped[User] = relationship(
        "User", back_populates="created_documents", foreign_keys=[created_by_user_id],
    )
    deleted_by: Mapped[User | None] = relationship(
        "User", foreign_keys=[deleted_by_user_id],
    )
    versions: Mapped[list[DocumentVersion]] = relationship(
        "DocumentVersion",
        back_populates="document",
        foreign_keys="DocumentVersion.document_id",
    )
    current_version: Mapped[DocumentVersion | None] = relationship(
        "DocumentVersion",
        foreign_keys=[id, current_version_id],
        post_update=True,
    )
    permissions: Mapped[list[DocumentPermission]] = relationship(
        "DocumentPermission", back_populates="document",
    )
    audit_logs: Mapped[list[DocumentAuditLog]] = relationship(
        "DocumentAuditLog", back_populates="document",
    )

    __table_args__ = (
        CheckConstraint("length(btrim(title)) > 0", name="ck_documents_title_nonempty"),
        CheckConstraint(
            "classification IN ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')",
            name="ck_documents_classification",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'ARCHIVED', 'DELETED')",
            name="ck_documents_status",
        ),
        CheckConstraint(
            "jsonb_typeof(custom_metadata) = 'object'",
            name="ck_documents_custom_metadata_object",
        ),
        ForeignKeyConstraint(
            ["id", "current_version_id"],
            ["document_versions.document_id", "document_versions.id"],
            name="fk_documents_current_version_same_document",
            use_alter=True,
        ),
        Index(
            "ix_documents_owner_status_updated",
            "owner_user_id",
            "status",
            updated_at.desc(),
        ),
        Index("ix_documents_created_at", created_at.desc()),
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_bucket: Mapped[str] = mapped_column(String(63), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    s3_version_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_extension: Mapped[str | None] = mapped_column(String(20), nullable=True)
    content_type: Mapped[str] = mapped_column(String(127), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    scan_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    document: Mapped[Document] = relationship(
        "Document", back_populates="versions", foreign_keys=[document_id],
    )
    uploaded_by: Mapped[User] = relationship(
        "User", back_populates="uploaded_document_versions",
        foreign_keys=[uploaded_by_user_id],
    )

    __table_args__ = (
        UniqueConstraint("document_id", "version_number", name="uq_document_versions_document_number"),
        UniqueConstraint("document_id", "id", name="uq_document_versions_document_id_id"),
        UniqueConstraint("storage_bucket", "storage_key", name="uq_document_versions_storage_location"),
        CheckConstraint("version_number > 0", name="ck_document_versions_number_positive"),
        CheckConstraint("size_bytes >= 0", name="ck_document_versions_size_nonnegative"),
        CheckConstraint(
            "checksum_sha256 ~ '^[0-9A-Fa-f]{64}$'",
            name="ck_document_versions_checksum_sha256",
        ),
        CheckConstraint(
            "status IN ('PENDING_UPLOAD', 'PENDING_SCAN', 'AVAILABLE', "
            "'QUARANTINED', 'FAILED', 'PURGE_PENDING', 'PURGED')",
            name="ck_document_versions_status",
        ),
        CheckConstraint(
            "storage_key = 'documents/' || document_id::text || '/versions/' || id::text || '/content'",
            name="ck_document_versions_application_storage_key",
        ),
    )


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    can_view: Mapped[bool] = mapped_column(Boolean, nullable=False)
    can_download: Mapped[bool] = mapped_column(Boolean, nullable=False)
    granted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    revoked_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    document: Mapped[Document] = relationship(
        "Document", back_populates="permissions",
    )
    user: Mapped[User] = relationship(
        "User", back_populates="document_permissions", foreign_keys=[user_id],
    )
    granted_by: Mapped[User] = relationship(
        "User",
        back_populates="granted_document_permissions",
        foreign_keys=[granted_by_user_id],
    )
    revoked_by: Mapped[User | None] = relationship(
        "User",
        back_populates="revoked_document_permissions",
        foreign_keys=[revoked_by_user_id],
    )

    __table_args__ = (
        UniqueConstraint("document_id", "user_id", name="uq_document_permissions_document_user"),
        CheckConstraint(
            "can_download = FALSE OR can_view = TRUE",
            name="ck_document_permissions_download_requires_view",
        ),
        Index("ix_document_permissions_user_document", "user_id", "document_id"),
    )

    @property
    def is_effective(self) -> bool:
        """Whether this grant is active at the current time."""
        now = datetime.now(timezone.utc)
        return (
            self.revoked_at is None
            and (self.expires_at is None or self.expires_at > now)
            and self.document.status != "DELETED"
        )


class DocumentAuditLog(Base):
    __tablename__ = "document_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    document_id_snapshot: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )

    document: Mapped[Document | None] = relationship(
        "Document", back_populates="audit_logs",
    )
    actor: Mapped[User | None] = relationship(
        "User", back_populates="document_audit_logs_as_actor",
        foreign_keys=[actor_user_id],
    )
    target_user: Mapped[User | None] = relationship(
        "User", back_populates="document_audit_logs_as_target",
        foreign_keys=[target_user_id],
    )

    __table_args__ = (
        CheckConstraint(
            "action_type IN ('DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', "
            "'DOCUMENT_DOWNLOADED', 'DOCUMENT_METADATA_UPDATED', "
            "'DOCUMENT_VERSION_CREATED', 'DOCUMENT_DELETED', "
            "'DOCUMENT_RESTORED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', "
            "'UPLOAD_REJECTED', 'ACCESS_DENIED')",
            name="ck_document_audit_logs_action_type",
        ),
        CheckConstraint(
            "result IN ('SUCCESS', 'DENIED', 'FAILED')",
            name="ck_document_audit_logs_result",
        ),
        CheckConstraint(
            "jsonb_typeof(details) = 'object'",
            name="ck_document_audit_logs_details_object",
        ),
        Index(
            "ix_document_audit_logs_document_occurred",
            "document_id_snapshot",
            occurred_at.desc(),
        ),
        Index(
            "ix_document_audit_logs_actor_occurred",
            "actor_user_id",
            occurred_at.desc(),
        ),
        Index(
            "ix_document_audit_logs_action_occurred",
            "action_type",
            occurred_at.desc(),
        ),
    )
