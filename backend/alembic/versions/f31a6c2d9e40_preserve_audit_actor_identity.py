"""add actor and recipient identity snapshots for new audit rows

Revision ID: f31a6c2d9e40
Revises: e28b7a4c9f31
Create Date: 2026-10-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f31a6c2d9e40"
down_revision: Union[str, Sequence[str], None] = "e28b7a4c9f31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("document_audit_logs", sa.Column("actor_user_id_snapshot", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("document_audit_logs", sa.Column("actor_name_snapshot", sa.String(length=150), nullable=True))
    op.add_column("document_audit_logs", sa.Column("actor_email_snapshot", sa.String(length=320), nullable=True))
    op.add_column("document_audit_logs", sa.Column("actor_role_snapshot", sa.String(length=20), nullable=True))
    op.add_column("document_audit_logs", sa.Column("target_user_id_snapshot", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("document_audit_logs", sa.Column("target_name_snapshot", sa.String(length=150), nullable=True))
    op.add_column("document_audit_logs", sa.Column("target_email_snapshot", sa.String(length=320), nullable=True))

    # Existing audit rows are append-only in PostgreSQL and are not rewritten.
    # The application snapshots identities for events created after this revision.


def downgrade() -> None:
    op.drop_column("document_audit_logs", "target_email_snapshot")
    op.drop_column("document_audit_logs", "target_name_snapshot")
    op.drop_column("document_audit_logs", "target_user_id_snapshot")
    op.drop_column("document_audit_logs", "actor_role_snapshot")
    op.drop_column("document_audit_logs", "actor_email_snapshot")
    op.drop_column("document_audit_logs", "actor_name_snapshot")
    op.drop_column("document_audit_logs", "actor_user_id_snapshot")
