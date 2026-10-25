"""remove the TOTP authentication methods table

Revision ID: e3f2a9b18c7d
Revises: c81d2f9a4e30
Create Date: 2026-06-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e3f2a9b18c7d"
down_revision: Union[str, Sequence[str], None] = "c81d2f9a4e30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("user_mfa_methods")


def downgrade() -> None:
    op.create_table(
        "user_mfa_methods",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "method_type",
            sa.String(length=16),
            server_default=sa.text("'TOTP'"),
            nullable=False,
        ),
        sa.Column("secret_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column(
            "is_enabled",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("setup_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_counter", sa.BigInteger(), nullable=True),
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
            "method_type = 'TOTP'",
            name="ck_user_mfa_methods_type",
        ),
        sa.CheckConstraint(
            "NOT is_enabled OR confirmed_at IS NOT NULL",
            name="ck_user_mfa_methods_enabled_confirmed",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_user_mfa_methods_user",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_mfa_methods"),
        sa.UniqueConstraint(
            "user_id",
            "method_type",
            name="uq_user_mfa_methods_user_type",
        ),
    )
    op.create_index(
        "ix_user_mfa_methods_user_enabled",
        "user_mfa_methods",
        ["user_id", "is_enabled"],
    )
