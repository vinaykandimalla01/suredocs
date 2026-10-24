"""audit administrative user role and status changes

Revision ID: c7e91a4b0d32
Revises: b1d4f02a8e6c
Create Date: 2026-10-24

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7e91a4b0d32"
down_revision: Union[str, Sequence[str], None] = "b1d4f02a8e6c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_PREVIOUS_EVENTS = (
    "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT", "ACCOUNT_LOCKED",
    "SESSION_REVOKED", "AUTH_REJECTED_INACTIVE", "PASSWORD_CHANGED",
    "MFA_ENABLED", "MFA_DISABLED", "MFA_REJECTED",
)
_EVENTS = _PREVIOUS_EVENTS + ("USER_ROLE_CHANGED", "USER_STATUS_CHANGED")


def _values(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def upgrade() -> None:
    op.drop_constraint("ck_auth_events_event_type", "auth_events", type_="check")
    op.drop_constraint("auth_event_type", "auth_events", type_="check")
    event_check = f"event_type IN ({_values(_EVENTS)})"
    op.create_check_constraint("auth_event_type", "auth_events", event_check)
    op.create_check_constraint("ck_auth_events_event_type", "auth_events", event_check)


def downgrade() -> None:
    op.drop_constraint("ck_auth_events_event_type", "auth_events", type_="check")
    op.drop_constraint("auth_event_type", "auth_events", type_="check")
    event_check = f"event_type IN ({_values(_PREVIOUS_EVENTS)})"
    op.create_check_constraint("auth_event_type", "auth_events", event_check)
    op.create_check_constraint("ck_auth_events_event_type", "auth_events", event_check)
