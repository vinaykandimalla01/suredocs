"""extend document authorization and persist request and user settings data

Revision ID: b1d4f02a8e6c
Revises: 8f2c1a6d4b73
Create Date: 2026-10-24

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b1d4f02a8e6c"
down_revision: Union[str, Sequence[str], None] = "8f2c1a6d4b73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_AUTH_EVENTS = (
    "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT", "ACCOUNT_LOCKED",
    "SESSION_REVOKED", "AUTH_REJECTED_INACTIVE", "PASSWORD_CHANGED",
    "MFA_ENABLED", "MFA_DISABLED", "MFA_REJECTED",
)
_DOCUMENT_ACTIONS = (
    "DOCUMENT_UPLOADED", "DOCUMENT_VIEWED", "DOCUMENT_DOWNLOADED",
    "DOCUMENT_METADATA_UPDATED", "DOCUMENT_VERSION_CREATED",
    "DOCUMENT_DELETED", "DOCUMENT_RESTORED", "PERMISSION_GRANTED",
    "PERMISSION_REVOKED", "UPLOAD_REJECTED", "ACCESS_DENIED",
    "ACCESS_REQUEST_SUBMITTED", "ACCESS_REQUEST_APPROVED",
    "ACCESS_REQUEST_DENIED", "ACCESS_REQUEST_CANCELLED",
)


def _sql_values(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=40), nullable=True))
    op.add_column("users", sa.Column("location", sa.String(length=160), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(length=1000), nullable=True))

    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_constraint("user_role", "users", type_="check")
    role_check = "role IN ('ADMIN', 'MANAGER', 'EMPLOYEE')"
    op.create_check_constraint("user_role", "users", role_check)
    op.create_check_constraint("ck_users_role", "users", role_check)

    op.add_column(
        "document_permissions",
        sa.Column("can_edit", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_check_constraint(
        "ck_document_permissions_edit_requires_view",
        "document_permissions",
        "can_edit = FALSE OR can_view = TRUE",
    )

    op.drop_constraint("ck_document_audit_logs_action_type", "document_audit_logs", type_="check")
    op.create_check_constraint(
        "ck_document_audit_logs_action_type",
        "document_audit_logs",
        f"action_type IN ({_sql_values(_DOCUMENT_ACTIONS)})",
    )

    op.drop_constraint("ck_auth_events_event_type", "auth_events", type_="check")
    op.drop_constraint("auth_event_type", "auth_events", type_="check")
    event_check = f"event_type IN ({_sql_values(_AUTH_EVENTS)})"
    op.create_check_constraint("auth_event_type", "auth_events", event_check)
    op.create_check_constraint("ck_auth_events_event_type", "auth_events", event_check)

    op.create_table(
        "access_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default=sa.text("'PENDING'"), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resulting_permission_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED', 'EXPIRED')",
            name="ck_access_requests_status",
        ),
        sa.CheckConstraint("length(btrim(reason)) > 0", name="ck_access_requests_reason_nonempty"),
        sa.CheckConstraint(
            "jsonb_typeof(requested_permissions) = 'object' "
            "AND requested_permissions - ARRAY['can_view', 'can_download', 'can_edit']::text[] = '{}'::jsonb "
            "AND (NOT (requested_permissions ? 'can_view') OR jsonb_typeof(requested_permissions->'can_view') = 'boolean') "
            "AND (NOT (requested_permissions ? 'can_download') OR jsonb_typeof(requested_permissions->'can_download') = 'boolean') "
            "AND (NOT (requested_permissions ? 'can_edit') OR jsonb_typeof(requested_permissions->'can_edit') = 'boolean') "
            "AND (requested_permissions @> '{\"can_view\": true}'::jsonb "
            "OR requested_permissions @> '{\"can_download\": true}'::jsonb "
            "OR requested_permissions @> '{\"can_edit\": true}'::jsonb)",
            name="ck_access_requests_permissions_shape",
        ),
        sa.CheckConstraint(
            "(decided_at IS NULL) = (decided_by_user_id IS NULL)",
            name="ck_access_requests_decision_actor_time",
        ),
        sa.CheckConstraint(
            "status != 'APPROVED' OR resulting_permission_id IS NOT NULL",
            name="ck_access_requests_approved_has_grant",
        ),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="RESTRICT", name="fk_access_requests_document"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="RESTRICT", name="fk_access_requests_requester"),
        sa.ForeignKeyConstraint(["decided_by_user_id"], ["users.id"], ondelete="SET NULL", name="fk_access_requests_decider"),
        sa.ForeignKeyConstraint(["resulting_permission_id"], ["document_permissions.id"], ondelete="SET NULL", name="fk_access_requests_permission"),
        sa.PrimaryKeyConstraint("id", name="pk_access_requests"),
    )
    op.create_index(
        "ix_access_requests_document_pending", "access_requests", ["document_id", "requested_at"],
        postgresql_where=sa.text("status = 'PENDING'"),
    )
    op.create_index("ix_access_requests_requester_requested", "access_requests", ["requester_user_id", sa.text("requested_at DESC")])
    op.create_index(
        "uq_access_requests_pending_document_requester", "access_requests",
        ["document_id", "requester_user_id"], unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("recipient_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notification_type", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("jsonb_typeof(metadata) = 'object'", name="ck_notifications_metadata_object"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="RESTRICT", name="fk_notifications_recipient"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL", name="fk_notifications_actor"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL", name="fk_notifications_document"),
        sa.PrimaryKeyConstraint("id", name="pk_notifications"),
    )
    op.create_index("ix_notifications_recipient_created", "notifications", ["recipient_user_id", sa.text("created_at DESC")])
    op.create_index(
        "ix_notifications_recipient_unread", "notifications", ["recipient_user_id", sa.text("created_at DESC")],
        postgresql_where=sa.text("read_at IS NULL"),
    )

    op.create_table(
        "user_preferences",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notification_settings", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("display_settings", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("jsonb_typeof(notification_settings) = 'object'", name="ck_user_preferences_notifications_object"),
        sa.CheckConstraint("jsonb_typeof(display_settings) = 'object'", name="ck_user_preferences_display_object"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT", name="fk_user_preferences_user"),
        sa.PrimaryKeyConstraint("user_id", name="pk_user_preferences"),
    )

    op.create_table(
        "user_mfa_methods",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("method_type", sa.String(length=16), server_default=sa.text("'TOTP'"), nullable=False),
        sa.Column("secret_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("setup_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_counter", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("method_type = 'TOTP'", name="ck_user_mfa_methods_type"),
        sa.CheckConstraint("NOT is_enabled OR confirmed_at IS NOT NULL", name="ck_user_mfa_methods_enabled_confirmed"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT", name="fk_user_mfa_methods_user"),
        sa.PrimaryKeyConstraint("id", name="pk_user_mfa_methods"),
        sa.UniqueConstraint("user_id", "method_type", name="uq_user_mfa_methods_user_type"),
    )
    op.create_index("ix_user_mfa_methods_user_enabled", "user_mfa_methods", ["user_id", "is_enabled"])

    op.execute("""
        CREATE FUNCTION suredocs_reject_audit_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'security audit records are append-only';
        END;
        $$;
    """)
    for table in ("auth_events", "document_audit_logs"):
        op.execute(
            f"CREATE TRIGGER {table}_append_only "
            f"BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION suredocs_reject_audit_mutation()"
        )


def downgrade() -> None:
    bind = op.get_bind()
    manager_count = bind.execute(sa.text("SELECT count(*) FROM users WHERE role = 'MANAGER'")).scalar_one()
    if manager_count:
        raise RuntimeError("Cannot downgrade while MANAGER accounts exist; migrate those accounts explicitly first.")

    for table in ("auth_events", "document_audit_logs"):
        op.execute(f"DROP TRIGGER {table}_append_only ON {table}")
    op.execute("DROP FUNCTION suredocs_reject_audit_mutation()")

    op.drop_index("ix_user_mfa_methods_user_enabled", table_name="user_mfa_methods")
    op.drop_table("user_mfa_methods")
    op.drop_table("user_preferences")
    op.drop_index("ix_notifications_recipient_unread", table_name="notifications")
    op.drop_index("ix_notifications_recipient_created", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("uq_access_requests_pending_document_requester", table_name="access_requests")
    op.drop_index("ix_access_requests_requester_requested", table_name="access_requests")
    op.drop_index("ix_access_requests_document_pending", table_name="access_requests")
    op.drop_table("access_requests")

    op.drop_constraint("ck_auth_events_event_type", "auth_events", type_="check")
    op.drop_constraint("auth_event_type", "auth_events", type_="check")
    original_events = ("LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT", "ACCOUNT_LOCKED", "SESSION_REVOKED", "AUTH_REJECTED_INACTIVE")
    original_event_check = f"event_type IN ({_sql_values(original_events)})"
    op.create_check_constraint("auth_event_type", "auth_events", original_event_check)
    op.create_check_constraint("ck_auth_events_event_type", "auth_events", original_event_check)

    op.drop_constraint("ck_document_audit_logs_action_type", "document_audit_logs", type_="check")
    old_actions = _DOCUMENT_ACTIONS[:11]
    op.create_check_constraint(
        "ck_document_audit_logs_action_type", "document_audit_logs",
        f"action_type IN ({_sql_values(old_actions)})",
    )

    op.drop_constraint("ck_document_permissions_edit_requires_view", "document_permissions", type_="check")
    op.drop_column("document_permissions", "can_edit")

    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_constraint("user_role", "users", type_="check")
    old_role_check = "role IN ('ADMIN', 'EMPLOYEE')"
    op.create_check_constraint("user_role", "users", old_role_check)
    op.create_check_constraint("ck_users_role", "users", old_role_check)
    op.drop_column("users", "bio")
    op.drop_column("users", "location")
    op.drop_column("users", "phone")
