"""
User model — stores identity, credentials, role, and security metadata.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.documents import (
        Document,
        DocumentAuditLog,
        DocumentPermission,
        DocumentVersion,
    )


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"


class AccountStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DISABLED = "DISABLED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    full_name: Mapped[str] = mapped_column(String(150), nullable=False)

    email: Mapped[str] = mapped_column(String(320), nullable=False)

    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=True, native_enum=False, length=20),
        nullable=False,
    )

    account_status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus, name="account_status", create_constraint=True, native_enum=False, length=20),
        nullable=False,
        default=AccountStatus.PENDING,
    )

    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    employee_code: Mapped[str | None] = mapped_column(String(32), nullable=True)

    department: Mapped[str | None] = mapped_column(String(100), nullable=True)

    job_title: Mapped[str | None] = mapped_column(String(100), nullable=True)

    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )

    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    must_change_password: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
    )

    # Relationships
    sessions: Mapped[list["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan",
    )
    creator: Mapped[User | None] = relationship(
        "User", remote_side="User.id", foreign_keys=[created_by],
    )
    owned_documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="owner", foreign_keys="Document.owner_user_id",
    )
    created_documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="creator", foreign_keys="Document.created_by_user_id",
    )
    uploaded_document_versions: Mapped[list["DocumentVersion"]] = relationship(
        "DocumentVersion",
        back_populates="uploaded_by",
        foreign_keys="DocumentVersion.uploaded_by_user_id",
    )
    document_permissions: Mapped[list["DocumentPermission"]] = relationship(
        "DocumentPermission",
        back_populates="user",
        foreign_keys="DocumentPermission.user_id",
    )
    granted_document_permissions: Mapped[list["DocumentPermission"]] = relationship(
        "DocumentPermission",
        back_populates="granted_by",
        foreign_keys="DocumentPermission.granted_by_user_id",
    )
    revoked_document_permissions: Mapped[list["DocumentPermission"]] = relationship(
        "DocumentPermission",
        back_populates="revoked_by",
        foreign_keys="DocumentPermission.revoked_by_user_id",
    )
    document_audit_logs_as_actor: Mapped[list["DocumentAuditLog"]] = relationship(
        "DocumentAuditLog",
        back_populates="actor",
        foreign_keys="DocumentAuditLog.actor_user_id",
    )
    document_audit_logs_as_target: Mapped[list["DocumentAuditLog"]] = relationship(
        "DocumentAuditLog",
        back_populates="target_user",
        foreign_keys="DocumentAuditLog.target_user_id",
    )

    __table_args__ = (
        # Case-insensitive unique email index
        Index("ix_users_email_lower", func.lower(email), unique=True),
        Index("ix_users_employee_code", "employee_code", unique=True),
        # Prevent ACTIVE status when password_hash is null
        CheckConstraint(
            "account_status != 'ACTIVE' OR password_hash IS NOT NULL",
            name="ck_users_active_requires_password",
        ),
        # Ensure failed_login_attempts is non-negative
        CheckConstraint(
            "failed_login_attempts >= 0",
            name="ck_users_failed_login_nonneg",
        ),
        CheckConstraint(
            "role IN ('ADMIN', 'MANAGER', 'EMPLOYEE')",
            name="ck_users_role",
        ),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role.value}>"


# Import here to avoid circular import issues — used by relationship above.
from app.models.user_session import UserSession  # noqa: E402, F811
