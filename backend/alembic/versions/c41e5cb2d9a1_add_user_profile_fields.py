"""add user profile fields

Revision ID: c41e5cb2d9a1
Revises: 715e7f667408
Create Date: 2026-10-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c41e5cb2d9a1"
down_revision: Union[str, Sequence[str], None] = "715e7f667408"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("employee_code", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("department", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("job_title", sa.String(length=100), nullable=True))
    op.create_index("ix_users_employee_code", "users", ["employee_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_employee_code", table_name="users")
    op.drop_column("users", "job_title")
    op.drop_column("users", "department")
    op.drop_column("users", "employee_code")
