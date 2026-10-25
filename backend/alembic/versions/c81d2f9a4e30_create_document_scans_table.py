"""create document_scans table for clamav antivirus audit tracking

Revision ID: c81d2f9a4e30
Revises: b43a9d7c1e20
Create Date: 2026-10-25

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c81d2f9a4e30"
down_revision: Union[str, Sequence[str], None] = "b43a9d7c1e20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_scans",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_versions.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "scan_status",
            sa.String(32),
            nullable=False,
            server_default=sa.text("'PENDING_SCAN'"),
        ),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_hash_sha256", sa.String(64), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column(
            "scanner_name",
            sa.String(64),
            nullable=False,
            server_default=sa.text("'ClamAV'"),
        ),
        sa.Column("scanner_version", sa.String(128), nullable=True),
        sa.Column("detection_name", sa.String(255), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column(
            "retry_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "scan_started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("scan_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "scan_status IN ('PENDING_SCAN', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_FAILED')",
            name="ck_document_scans_status",
        ),
    )
    op.create_index(
        "ix_document_scans_document_id", "document_scans", ["document_id"]
    )
    op.create_index(
        "ix_document_scans_version_id", "document_scans", ["version_id"]
    )
    op.create_index(
        "ix_document_scans_status", "document_scans", ["scan_status"]
    )
    op.create_index(
        "ix_document_scans_created_at",
        "document_scans",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_document_scans_created_at", table_name="document_scans")
    op.drop_index("ix_document_scans_status", table_name="document_scans")
    op.drop_index("ix_document_scans_version_id", table_name="document_scans")
    op.drop_index("ix_document_scans_document_id", table_name="document_scans")
    op.drop_table("document_scans")
