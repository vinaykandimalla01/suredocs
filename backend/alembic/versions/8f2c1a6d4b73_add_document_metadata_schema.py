"""add document metadata schema

Revision ID: 8f2c1a6d4b73
Revises: c41e5cb2d9a1
Create Date: 2026-10-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "8f2c1a6d4b73"
down_revision: Union[str, Sequence[str], None] = "c41e5cb2d9a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("classification", sa.String(length=20), nullable=False),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("current_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'ACTIVE'"),
            nullable=False,
        ),
        sa.Column(
            "custom_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint(
            "length(btrim(title)) > 0",
            name="ck_documents_title_nonempty",
        ),
        sa.CheckConstraint(
            "classification IN ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')",
            name="ck_documents_classification",
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'ARCHIVED', 'DELETED')",
            name="ck_documents_status",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(custom_metadata) = 'object'",
            name="ck_documents_custom_metadata_object",
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_documents_owner_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="fk_documents_created_by_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by_user_id"],
            ["users.id"],
            name="fk_documents_deleted_by_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_documents"),
    )
    op.create_index(
        "ix_documents_owner_status_updated",
        "documents",
        ["owner_user_id", "status", sa.text("updated_at DESC")],
    )
    op.create_index(
        "ix_documents_created_at",
        "documents",
        [sa.text("created_at DESC")],
    )

    op.create_table(
        "document_versions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("storage_bucket", sa.String(length=63), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("s3_version_id", sa.Text(), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_extension", sa.String(length=20), nullable=True),
        sa.Column("content_type", sa.String(length=127), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("uploaded_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scan_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "version_number > 0",
            name="ck_document_versions_number_positive",
        ),
        sa.CheckConstraint(
            "size_bytes >= 0",
            name="ck_document_versions_size_nonnegative",
        ),
        sa.CheckConstraint(
            "checksum_sha256 ~ '^[0-9A-Fa-f]{64}$'",
            name="ck_document_versions_checksum_sha256",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING_UPLOAD', 'PENDING_SCAN', 'AVAILABLE', "
            "'QUARANTINED', 'FAILED', 'PURGE_PENDING', 'PURGED')",
            name="ck_document_versions_status",
        ),
        sa.CheckConstraint(
            "storage_key = 'documents/' || document_id::text || '/versions/' || id::text || '/content'",
            name="ck_document_versions_application_storage_key",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name="fk_document_versions_document_id_documents",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_user_id"],
            ["users.id"],
            name="fk_document_versions_uploaded_by_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_document_versions"),
        sa.UniqueConstraint(
            "document_id",
            "version_number",
            name="uq_document_versions_document_number",
        ),
        sa.UniqueConstraint(
            "document_id",
            "id",
            name="uq_document_versions_document_id_id",
        ),
        sa.UniqueConstraint(
            "storage_bucket",
            "storage_key",
            name="uq_document_versions_storage_location",
        ),
    )

    op.create_table(
        "document_permissions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("can_view", sa.Boolean(), nullable=False),
        sa.Column("can_download", sa.Boolean(), nullable=False),
        sa.Column("granted_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "can_download = FALSE OR can_view = TRUE",
            name="ck_document_permissions_download_requires_view",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name="fk_document_permissions_document_id_documents",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_document_permissions_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["granted_by_user_id"],
            ["users.id"],
            name="fk_document_permissions_granted_by_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["revoked_by_user_id"],
            ["users.id"],
            name="fk_document_permissions_revoked_by_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_document_permissions"),
        sa.UniqueConstraint(
            "document_id",
            "user_id",
            name="uq_document_permissions_document_user",
        ),
    )
    op.create_index(
        "ix_document_permissions_user_document",
        "document_permissions",
        ["user_id", "document_id"],
    )

    op.create_table(
        "document_audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_id_snapshot", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("result", sa.String(length=20), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(length=100), nullable=True),
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "action_type IN ('DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', "
            "'DOCUMENT_DOWNLOADED', 'DOCUMENT_METADATA_UPDATED', "
            "'DOCUMENT_VERSION_CREATED', 'DOCUMENT_DELETED', "
            "'DOCUMENT_RESTORED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', "
            "'UPLOAD_REJECTED', 'ACCESS_DENIED')",
            name="ck_document_audit_logs_action_type",
        ),
        sa.CheckConstraint(
            "result IN ('SUCCESS', 'DENIED', 'FAILED')",
            name="ck_document_audit_logs_result",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(details) = 'object'",
            name="ck_document_audit_logs_details_object",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name="fk_document_audit_logs_document_id_documents",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name="fk_document_audit_logs_actor_user_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_user_id"],
            ["users.id"],
            name="fk_document_audit_logs_target_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_document_audit_logs"),
    )
    op.create_index(
        "ix_document_audit_logs_document_occurred",
        "document_audit_logs",
        ["document_id_snapshot", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_document_audit_logs_actor_occurred",
        "document_audit_logs",
        ["actor_user_id", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_document_audit_logs_action_occurred",
        "document_audit_logs",
        ["action_type", sa.text("occurred_at DESC")],
    )

    op.create_foreign_key(
        "fk_documents_current_version_same_document",
        "documents",
        "document_versions",
        ["id", "current_version_id"],
        ["document_id", "id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_documents_current_version_same_document",
        "documents",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_document_audit_logs_action_occurred",
        table_name="document_audit_logs",
    )
    op.drop_index(
        "ix_document_audit_logs_actor_occurred",
        table_name="document_audit_logs",
    )
    op.drop_index(
        "ix_document_audit_logs_document_occurred",
        table_name="document_audit_logs",
    )
    op.drop_table("document_audit_logs")
    op.drop_index(
        "ix_document_permissions_user_document",
        table_name="document_permissions",
    )
    op.drop_table("document_permissions")
    op.drop_table("document_versions")
    op.drop_index("ix_documents_created_at", table_name="documents")
    op.drop_index("ix_documents_owner_status_updated", table_name="documents")
    op.drop_table("documents")
