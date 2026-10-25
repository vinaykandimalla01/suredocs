"""merge password-reset and permission migration heads

Revision ID: b43a9d7c1e20
Revises: a82bf4d30917, 749384f5fc76
Create Date: 2026-10-25
"""

from typing import Sequence, Union


revision: str = "b43a9d7c1e20"
down_revision: Union[str, Sequence[str], None] = (
    "a82bf4d30917",
    "749384f5fc76",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
