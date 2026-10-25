"""persist owner reports against immutable document audit events

Revision ID: e28b7a4c9f31
Revises: d53f7a1c8b20
Create Date: 2026-10-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e28b7a4c9f31"
down_revision: Union[str, Sequence[str], None] = "d53f7a1c8b20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_audit_security_flags",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"), nullable=False,
        ),
        sa.Column(
            "event_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_audit_logs.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("document_id_snapshot", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "reported_by_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason_code", sa.String(length=40), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "submitted_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.UniqueConstraint("submission_id", name="uq_document_audit_security_flags_submission"),
        sa.CheckConstraint(
            "reason_code IN ('SUSPICIOUS_ACCESS', 'UNEXPECTED_DOWNLOAD', "
            "'UNAUTHORIZED_ATTEMPT', 'PERMISSION_CHANGE', 'UNRECOGNIZED_ACTOR', 'OTHER')",
            name="ck_document_audit_security_flags_reason",
        ),
        sa.CheckConstraint(
            "description IS NULL OR length(description) <= 2000",
            name="ck_document_audit_security_flags_description_length",
        ),
    )
    op.create_index(
        "ix_document_audit_security_flags_event",
        "document_audit_security_flags",
        ["event_id", sa.text("submitted_at DESC")],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_document_audit_security_flags_event",
        table_name="document_audit_security_flags",
    )
    op.drop_table("document_audit_security_flags")
