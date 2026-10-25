"""add_revocation_reason_to_document_permissions

Revision ID: 749384f5fc76
Revises: f31a6c2d9e40
Create Date: 2026-10-25 05:51:48.474062

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '749384f5fc76'
down_revision: Union[str, Sequence[str], None] = 'f31a6c2d9e40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'document_permissions',
        sa.Column('revocation_reason', sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('document_permissions', 'revocation_reason')
