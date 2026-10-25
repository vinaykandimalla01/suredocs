#!/usr/bin/env python3
"""Safely seed realistic access-request records using existing SureDocs data."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import and_, select, text
from sqlalchemy.exc import SQLAlchemyError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal  # noqa: E402
from app.models.documents import Document, DocumentAuditLog, DocumentPermission, DocumentVersion  # noqa: E402
from app.models.persistence import AccessRequest  # noqa: E402
from app.models.user import AccountStatus, User  # noqa: E402
from app.services.notifications import add_notification  # noqa: E402

PENDING_TARGET = 23
DENIED_TARGET = 8
REQUESTER_POOL_SIZE = 18
ADVISORY_LOCK_KEY = 4_019_275_813_944_501_337
PERMISSION_TYPES = (
    {"can_view": True, "can_download": False, "can_edit": False},
    {"can_view": True, "can_download": True, "can_edit": False},
    {"can_view": True, "can_download": False, "can_edit": True},
    {"can_view": True, "can_download": True, "can_edit": True},
)
REASONS = (
    "Required for quarterly reporting.",
    "Need access to complete an assigned project.",
    "Required to verify financial records.",
    "Need to review the document for an internal audit.",
    "Required to prepare the monthly reconciliation report.",
    "Please share this so I can coordinate the department handoff.",
    "I need to confirm the latest approved process.",
    "This document is needed for the current compliance review.",
    "Required to complete the cross-functional project review.",
    "Please provide access for the scheduled planning meeting.",
)
DENIAL_REASONS = (
    "The document owner declined the request because access is not needed for the current assignment.",
    "The requested access was not approved for this document.",
    "The owner confirmed that the information is outside the requester's current scope.",
    "Access was declined pending a separate business approval.",
)


@dataclass(frozen=True)
class RequestPlan:
    requester: User
    document: Document
    owner: User
    status: str
    permissions: dict[str, bool]
    requested_at: datetime
    decided_at: datetime | None
    reason: str
    decision_reason: str | None


@dataclass(frozen=True)
class SeedPlan:
    users: list[User]
    documents: list[tuple[Document, User]]
    existing_requests: list[AccessRequest]
    entries: list[RequestPlan]
    demo_user: User | None
    pending_target: int
    denied_target: int
    current_pending_for_demo_user: int
    current_denied_visible_to_demo_user: int


def _stable_order(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


def _build_plan(
    session,
    *,
    pending_target: int,
    denied_target: int,
) -> SeedPlan:
    session.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": ADVISORY_LOCK_KEY},
    )
    users = list(
        session.execute(
            select(User)
            .where(User.account_status == AccountStatus.ACTIVE)
            .order_by(User.email, User.id)
        ).scalars()
    )
    if len(users) < 10:
        raise RuntimeError(f"Only {len(users)} active users exist; at least 10 are required.")

    demo_user = next(
        (user for user in users if user.full_name.casefold() == "yamini pandey"),
        None,
    )
    if demo_user is None:
        raise RuntimeError("The pictured active user Yamini Pandey was not found.")
    requester_pool = sorted(users, key=lambda user: _stable_order(str(user.id)))[
        :REQUESTER_POOL_SIZE
    ]
    if demo_user is not None and demo_user not in requester_pool:
        requester_pool[-1] = demo_user

    document_rows = list(
        session.execute(
            select(Document, User)
            .join(
                DocumentVersion,
                and_(
                    DocumentVersion.document_id == Document.id,
                    DocumentVersion.id == Document.current_version_id,
                    DocumentVersion.status == "AVAILABLE",
                ),
            )
            .join(User, User.id == Document.owner_user_id)
            .where(
                Document.status == "ACTIVE",
                Document.deleted_at.is_(None),
                User.account_status == AccountStatus.ACTIVE,
            )
            .order_by(Document.id)
        ).all()
    )
    if not document_rows:
        raise RuntimeError("No active documents with available current versions were found.")
    document_rows.sort(key=lambda row: _stable_order(str(row[0].id)))

    existing_requests = list(
        session.execute(select(AccessRequest).order_by(AccessRequest.requested_at)).scalars()
    )
    status_counts: dict[str, int] = {}
    for request in existing_requests:
        status_counts[request.status] = status_counts.get(request.status, 0) + 1
    existing_pairs = {
        (request.document_id, request.requester_user_id)
        for request in existing_requests
    }
    permission_pairs = set(
        session.execute(
            select(DocumentPermission.document_id, DocumentPermission.user_id)
        ).all()
    )
    reserved_pairs = set(existing_pairs) | set(permission_pairs)

    owner_by_document = {
        document.id: owner.id for document, owner in document_rows
    }
    pending_for_demo_user = sum(
        request.status == "PENDING"
        and owner_by_document.get(request.document_id) == demo_user.id
        for request in existing_requests
    )
    denied_visible_to_demo_user = sum(
        request.status == "DENIED"
        and (
            owner_by_document.get(request.document_id) == demo_user.id
            or request.requester_user_id == demo_user.id
        )
        for request in existing_requests
    )
    pending_needed = max(0, pending_target - pending_for_demo_user)
    denied_needed = max(0, denied_target - denied_visible_to_demo_user)
    total_to_add = pending_needed + denied_needed
    now = datetime.now(timezone.utc)
    entries: list[RequestPlan] = []
    used_requesters: list[User] = []
    requester_cursor = 0
    document_cursor = 0

    demo_owned_documents = (
        [row for row in document_rows if demo_user is not None and row[1].id == demo_user.id]
        if demo_user is not None
        else []
    )

    def add_entries(
        status: str,
        count: int,
        *,
        demo_owner_count: int,
        demo_requester_count: int,
    ) -> None:
        nonlocal requester_cursor, document_cursor
        for index in range(count):
            slot = len(entries)
            requester_is_demo = (
                demo_user is not None
                and demo_requester_count > 0
                and index >= demo_owner_count
                and index < demo_owner_count + demo_requester_count
            )
            owner_is_demo = (
                demo_user is not None
                and bool(demo_owned_documents)
                and index < demo_owner_count
            )
            if requester_is_demo:
                requester = demo_user
            else:
                requester = requester_pool[requester_cursor % len(requester_pool)]
                requester_cursor += 1
                if owner_is_demo and requester.id == demo_user.id:
                    requester = requester_pool[requester_cursor % len(requester_pool)]
                    requester_cursor += 1

            candidates = demo_owned_documents if owner_is_demo else document_rows
            if not candidates:
                candidates = document_rows
            selected: tuple[Document, User] | None = None
            for offset in range(len(candidates)):
                row = candidates[(document_cursor + offset) % len(candidates)]
                document, owner = row
                pair = (document.id, requester.id)
                if (
                    owner.id == requester.id
                    or (requester_is_demo and owner.id == demo_user.id)
                    or pair in reserved_pairs
                ):
                    continue
                selected = row
                document_cursor = (document_cursor + offset + 1) % len(candidates)
                reserved_pairs.add(pair)
                break
            if selected is None:
                raise RuntimeError(
                    f"Could not find a valid document/requester pair for {status.lower()} "
                    f"request {index + 1}."
                )

            document, owner = selected
            requested_at = now - timedelta(minutes=(slot + 1) * 17)
            decided_at = (
                requested_at + timedelta(minutes=5) if status == "DENIED" else None
            )
            entries.append(
                RequestPlan(
                    requester=requester,
                    document=document,
                    owner=owner,
                    status=status,
                    permissions=PERMISSION_TYPES[slot % len(PERMISSION_TYPES)].copy(),
                    requested_at=requested_at,
                    decided_at=decided_at,
                    reason=REASONS[slot % len(REASONS)],
                    decision_reason=(
                        DENIAL_REASONS[slot % len(DENIAL_REASONS)]
                        if status == "DENIED"
                        else None
                    ),
                )
            )
            used_requesters.append(requester)

    add_entries(
        "PENDING",
        pending_needed,
        demo_owner_count=pending_needed,
        demo_requester_count=0,
    )
    add_entries(
        "DENIED",
        denied_needed,
        demo_owner_count=denied_needed,
        demo_requester_count=0,
    )

    distinct_requesters = {requester.id for requester in used_requesters}
    if total_to_add and len(distinct_requesters) < min(10, total_to_add):
        raise RuntimeError(
            f"Only {len(distinct_requesters)} distinct requesters were selected; "
            "at least 10 are required."
        )
    return SeedPlan(
        users=users,
        documents=document_rows,
        existing_requests=existing_requests,
        entries=entries,
        demo_user=demo_user,
        pending_target=pending_target,
        denied_target=denied_target,
        current_pending_for_demo_user=pending_for_demo_user,
        current_denied_visible_to_demo_user=denied_visible_to_demo_user,
    )


def _report(session, plan: SeedPlan, *, dry_run: bool) -> dict[str, Any]:
    existing_counts: dict[str, int] = {}
    for request in plan.existing_requests:
        existing_counts[request.status] = existing_counts.get(request.status, 0) + 1
    added_counts: dict[str, int] = {}
    for entry in plan.entries:
        added_counts[entry.status] = added_counts.get(entry.status, 0) + 1
    visible_to_demo_user = sum(
        1
        for entry in plan.entries
        if plan.demo_user is not None
        and (
            entry.owner.id == plan.demo_user.id
            or entry.requester.id == plan.demo_user.id
        )
    )
    return {
        "dry_run": dry_run,
        "active_users": len(plan.users),
        "eligible_documents": len(plan.documents),
        "existing_requests_by_status": existing_counts,
        "planned_new_requests_by_status": added_counts,
        "projected_requests_by_status": {
            status: existing_counts.get(status, 0) + added_counts.get(status, 0)
            for status in sorted(
                set(existing_counts)
                | set(added_counts)
            )
        },
        "planned_distinct_requesters": len(
            {entry.requester.id for entry in plan.entries}
        ),
        "planned_distinct_document_owners": len(
            {entry.owner.id for entry in plan.entries}
        ),
        "current_user": plan.demo_user.full_name if plan.demo_user else None,
        "current_user_pending_before": plan.current_pending_for_demo_user,
        "current_user_denied_before": plan.current_denied_visible_to_demo_user,
        "planned_requests_visible_to_current_user": visible_to_demo_user,
        "projected_current_user_pending": plan.current_pending_for_demo_user
        + added_counts.get("PENDING", 0),
        "projected_current_user_denied": plan.current_denied_visible_to_demo_user
        + added_counts.get("DENIED", 0),
        "approved_requests_reconciled": existing_counts.get("APPROVED", 0),
        "permission_records_modified": 0,
        "errors": [],
    }


def _apply(session, plan: SeedPlan) -> None:
    new_request_ids: list[str] = []
    for entry in plan.entries:
        request_id = uuid.uuid4()
        new_request_ids.append(str(request_id))
        request = AccessRequest(
            id=request_id,
            document_id=entry.document.id,
            requester_user_id=entry.requester.id,
            requested_permissions=entry.permissions,
            reason=entry.reason,
            status=entry.status,
            requested_at=entry.requested_at,
            decided_by_user_id=entry.owner.id if entry.status == "DENIED" else None,
            decided_at=entry.decided_at,
            decision_reason=entry.decision_reason,
            created_at=entry.requested_at,
            updated_at=entry.decided_at or entry.requested_at,
        )
        session.add(request)
        session.add(
            DocumentAuditLog(
                document_id=entry.document.id,
                document_id_snapshot=entry.document.id,
                actor_user_id=entry.requester.id,
                target_user_id=entry.owner.id,
                action_type="ACCESS_REQUEST_SUBMITTED",
                result="SUCCESS",
                occurred_at=entry.requested_at,
                request_id=str(request_id),
                details={
                    "access_request_id": str(request_id),
                    "requested_permissions": entry.permissions,
                    "new_status": entry.status,
                    "seeded_demo_record": True,
                },
            )
        )
        if entry.status == "PENDING":
            add_notification(
                session,
                recipient_user_id=entry.owner.id,
                actor_user_id=entry.requester.id,
                notification_type="ACCESS_REQUEST",
                title="Document access requested",
                message=f"{entry.requester.full_name} requested access to {entry.document.title}.",
                preference_key="document_access_requests",
                document_id=entry.document.id,
                metadata={"access_request_id": str(request_id)},
            )
        else:
            session.add(
                DocumentAuditLog(
                    document_id=entry.document.id,
                    document_id_snapshot=entry.document.id,
                    actor_user_id=entry.owner.id,
                    target_user_id=entry.requester.id,
                    action_type="ACCESS_REQUEST_DENIED",
                    result="SUCCESS",
                    occurred_at=entry.decided_at,
                    request_id=str(request_id),
                    details={
                        "access_request_id": str(request_id),
                        "requested_permissions": entry.permissions,
                        "previous_status": "PENDING",
                        "new_status": "DENIED",
                        "decision_reason": entry.decision_reason,
                        "seeded_demo_record": True,
                    },
                )
            )
            add_notification(
                session,
                recipient_user_id=entry.requester.id,
                actor_user_id=entry.owner.id,
                notification_type="ACCESS_REQUEST_DENIED",
                title="Document access declined",
                message=f"The request for {entry.document.title} was declined.",
                preference_key="access_request_decisions",
                document_id=entry.document.id,
                metadata={"access_request_id": str(request_id)},
            )

    session.flush()
    audit_count = session.scalar(
        select(text("count(*)")).select_from(DocumentAuditLog).where(
            DocumentAuditLog.request_id.in_(new_request_ids),
            DocumentAuditLog.action_type.in_(
                ["ACCESS_REQUEST_SUBMITTED", "ACCESS_REQUEST_DENIED"]
            ),
        )
    ) or 0
    expected_audits = sum(
        1 if entry.status == "PENDING" else 2 for entry in plan.entries
    )
    if audit_count != expected_audits:
        raise RuntimeError(
            f"Expected {expected_audits} request audit events, found {audit_count}."
        )

    counts = dict(
        session.execute(
            select(AccessRequest.status, text("count(*)"))
            .group_by(AccessRequest.status)
        ).all()
    )
    demo_visible_counts = session.execute(
        select(AccessRequest.status, text("count(*)"))
        .join(Document, Document.id == AccessRequest.document_id)
        .where(
            Document.owner_user_id == plan.demo_user.id,
            AccessRequest.status.in_(["PENDING", "DENIED"]),
        )
        .group_by(AccessRequest.status)
    ).all()
    owner_counts = dict(demo_visible_counts)
    denied_requested_by_demo = session.scalar(
        select(text("count(*)"))
        .select_from(AccessRequest)
        .where(
            AccessRequest.requester_user_id == plan.demo_user.id,
            AccessRequest.status == "DENIED",
            ~AccessRequest.document_id.in_(
                select(Document.id).where(Document.owner_user_id == plan.demo_user.id)
            ),
        )
    ) or 0
    if (
        owner_counts.get("PENDING", 0) != plan.pending_target
        or owner_counts.get("DENIED", 0) + denied_requested_by_demo
        != plan.denied_target
    ):
        raise RuntimeError(
            "Current-user request count validation failed: "
            f"pending={owner_counts.get('PENDING', 0)}, "
            f"denied={owner_counts.get('DENIED', 0) + denied_requested_by_demo}"
        )
    for entry in plan.entries:
        permission_count = session.scalar(
            select(text("count(*)")).select_from(DocumentPermission).where(
                DocumentPermission.document_id == entry.document.id,
                DocumentPermission.user_id == entry.requester.id,
            )
        )
        if permission_count:
            raise RuntimeError(
                "A seeded request unexpectedly has a permission row; "
                "transaction will be rolled back."
            )


def _run(args: argparse.Namespace) -> int:
    session = SessionLocal()
    try:
        session.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
        session.execute(text("SET LOCAL lock_timeout = '5s'"))
        session.execute(text("SET LOCAL statement_timeout = '120s'"))
        plan = _build_plan(
            session,
            pending_target=args.pending_target,
            denied_target=args.denied_target,
        )
        report = _report(session, plan, dry_run=not args.apply)
        if not args.apply:
            print(json.dumps(report, indent=2, sort_keys=True))
            session.rollback()
            return 0
        _apply(session, plan)
        session.commit()
        report["dry_run"] = False
        report["created_requests"] = len(plan.entries)
        report["created_audit_events"] = sum(
            1 if entry.status == "PENDING" else 2 for entry in plan.entries
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (RuntimeError, SQLAlchemyError) as exc:
        session.rollback()
        print(
            json.dumps(
                {"error": str(exc), "database_changes_committed": False},
                indent=2,
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 1
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Add missing access-request demo records using existing users and documents."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Plan without writing (default).")
    mode.add_argument("--apply", action="store_true", help="Create missing request and audit rows.")
    parser.add_argument("--pending-target", type=int, default=PENDING_TARGET)
    parser.add_argument("--denied-target", type=int, default=DENIED_TARGET)
    return _run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
