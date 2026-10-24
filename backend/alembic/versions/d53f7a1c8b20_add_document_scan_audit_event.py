"""allow document scan results in document audit history

Revision ID: d53f7a1c8b20
Revises: c7e91a4b0d32
Create Date: 2026-10-24

"""

from typing import Sequence, Union

from alembic import op


revision: str = "d53f7a1c8b20"
down_revision: Union[str, Sequence[str], None] = "c7e91a4b0d32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_PREVIOUS_EVENTS = (
    "DOCUMENT_UPLOADED", "DOCUMENT_VIEWED", "DOCUMENT_DOWNLOADED",
    "DOCUMENT_METADATA_UPDATED", "DOCUMENT_VERSION_CREATED",
    "DOCUMENT_DELETED", "DOCUMENT_RESTORED", "PERMISSION_GRANTED",
    "PERMISSION_REVOKED", "UPLOAD_REJECTED", "ACCESS_DENIED",
    "ACCESS_REQUEST_SUBMITTED", "ACCESS_REQUEST_APPROVED",
    "ACCESS_REQUEST_DENIED", "ACCESS_REQUEST_CANCELLED",
)
_EVENTS = _PREVIOUS_EVENTS + ("DOCUMENT_SCAN_COMPLETED",)


def _values(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def upgrade() -> None:
    op.drop_constraint(
        "ck_document_audit_logs_action_type",
        "document_audit_logs",
        type_="check",
    )
    op.create_check_constraint(
        "ck_document_audit_logs_action_type",
        "document_audit_logs",
        f"action_type IN ({_values(_EVENTS)})",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_document_audit_logs_action_type",
        "document_audit_logs",
        type_="check",
    )
    op.create_check_constraint(
        "ck_document_audit_logs_action_type",
        "document_audit_logs",
        f"action_type IN ({_values(_PREVIOUS_EVENTS)})",
    )
