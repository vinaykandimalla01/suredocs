#!/usr/bin/env python3
"""Backfill clearly marked demo requests for active document owners.

Preview with ``python scripts/seed_access_request_demo_data.py --dry-run``.
Apply only to the configured local database with
``python scripts/seed_access_request_demo_data.py --apply --confirm-database suredocs``.
"""

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

from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import DB_HOST, DB_NAME  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.documents import (  # noqa: E402
    Document,
    DocumentAuditLog,
    DocumentPermission,
    DocumentVersion,
)
from app.models.persistence import AccessRequest, Notification  # noqa: E402
from app.models.user import AccountStatus, User  # noqa: E402
from app.services.notifications import add_notification  # noqa: E402

PENDING_MIN = 36
PENDING_MAX = 42
DENIED_TARGET = 13
REQUESTER_POOL_SIZE = 128
ADVISORY_LOCK_KEY = 4_019_275_813_944_501_337
LOCAL_DB_HOSTS = {"127.0.0.1", "localhost", "::1"}
PERMISSION_TYPES = (
    {"can_view": True, "can_download": False, "can_edit": False},
    {"can_view": True, "can_download": True, "can_edit": False},
    {"can_view": True, "can_download": False, "can_edit": True},
    {"can_view": True, "can_download": True, "can_edit": True},
)
REASONS = (
    "Reviewing a document for a team assignment.",
    "Downloading a report for offline analysis.",
    "Updating an assigned document.",
    "Reviewing a compliance record.",
    "Preparing a project deliverable.",
    "Collaborating on a shared document.",
    "Verifying information for an internal audit.",
    "Accessing supporting documentation for a task.",
)
DENIAL_REASONS = (
    "The requested access is outside the requester's current assignment.",
    "The document owner declined access pending separate business approval.",
    "The requested permissions exceed the current project requirements.",
    "Access was declined because the document is not needed for this task.",
)


@dataclass(frozen=True)
class PlannedRequest:
    requester: User
    document: Document
    owner: User
    status: str
    permissions: dict[str, bool]
    requested_at: datetime
    decided_at: datetime | None
    reason: str
    decision_reason: str | None


@dataclass
class OwnerPlan:
    owner: User
    pending_before: int
    denied_before: int
    pending_target: int
    denied_target: int
    entries: list[PlannedRequest]
    issue: str | None = None


@dataclass
class SeedPlan:
    active_users: list[User]
    owners: list[OwnerPlan]
    all_user_count: int
    users_without_active_documents: int
    users_without_documents: list[User]
    inactive_document_owners: list[User]
    active_owners_without_available_versions: list[User]
    existing_status_counts: dict[str, int]

    @property
    def entries(self) -> list[PlannedRequest]:
        return [entry for owner in self.owners for entry in owner.entries]


def _stable_order(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


def _pending_target(owner_id: uuid.UUID) -> int:
    value = int.from_bytes(_stable_order(f"pending:{owner_id}")[:8], "big")
    return PENDING_MIN + value % (PENDING_MAX - PENDING_MIN + 1)


def _grant_covers(grant: DocumentPermission, requested: dict[str, bool]) -> bool:
    return all(
        not enabled or getattr(grant, permission)
        for permission, enabled in requested.items()
    )


def _build_plan(session) -> SeedPlan:
    session.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": ADVISORY_LOCK_KEY},
    )
    all_users = list(session.execute(select(User)).scalars())
    active_users = sorted(
        (user for user in all_users if user.account_status == AccountStatus.ACTIVE),
        key=lambda user: (user.email, str(user.id)),
    )
    now = datetime.now(timezone.utc)

    document_rows = list(
        session.execute(
            select(Document, User)
            .join(
                DocumentVersion,
                (DocumentVersion.document_id == Document.id)
                & (DocumentVersion.id == Document.current_version_id)
                & (DocumentVersion.status == "AVAILABLE"),
            )
            .join(User, User.id == Document.owner_user_id)
            .where(
                Document.status == "ACTIVE",
                Document.deleted_at.is_(None),
                User.account_status == AccountStatus.ACTIVE,
            )
            .order_by(Document.owner_user_id, Document.id)
        ).all()
    )
    documents_by_owner: dict[uuid.UUID, list[Document]] = {}
    eligible_documents: dict[uuid.UUID, Document] = {}
    for document, owner in document_rows:
        documents_by_owner.setdefault(owner.id, []).append(document)
        eligible_documents[document.id] = document

    existing_requests = list(
        session.execute(
            select(AccessRequest, Document.owner_user_id)
            .join(Document, Document.id == AccessRequest.document_id)
        ).all()
    )
    existing_counts: dict[uuid.UUID, dict[str, int]] = {}
    existing_status_counts: dict[str, int] = {}
    existing_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for request, owner_id in existing_requests:
        counts = existing_counts.setdefault(owner_id, {})
        counts[request.status] = counts.get(request.status, 0) + 1
        existing_status_counts[request.status] = (
            existing_status_counts.get(request.status, 0) + 1
        )
        existing_pairs.add((request.document_id, request.requester_user_id))

    document_ids = list(eligible_documents)
    active_grants: dict[tuple[uuid.UUID, uuid.UUID], list[DocumentPermission]] = {}
    if document_ids:
        grants = session.execute(
            select(DocumentPermission).where(
                DocumentPermission.document_id.in_(document_ids),
                DocumentPermission.revoked_at.is_(None),
                (DocumentPermission.expires_at.is_(None))
                | (DocumentPermission.expires_at > now),
            )
        ).scalars()
        for grant in grants:
            active_grants.setdefault((grant.document_id, grant.user_id), []).append(grant)

    owners: list[OwnerPlan] = []
    for owner_id, documents in sorted(
        documents_by_owner.items(), key=lambda pair: str(pair[0])
    ):
        owner = next(user for user in active_users if user.id == owner_id)
        counts = existing_counts.get(owner_id, {})
        pending_before = counts.get("PENDING", 0)
        denied_before = counts.get("DENIED", 0)
        pending_target = max(pending_before, _pending_target(owner.id))
        denied_target = max(denied_before, DENIED_TARGET)
        owner_plan = OwnerPlan(
            owner=owner,
            pending_before=pending_before,
            denied_before=denied_before,
            pending_target=pending_target,
            denied_target=DENIED_TARGET,
            entries=[],
        )

        if pending_before > PENDING_MAX:
            owner_plan.issue = (
                f"Already has {pending_before} pending requests; preserving existing records "
                f"would exceed the maximum of {PENDING_MAX}."
            )
        elif denied_before > DENIED_TARGET:
            owner_plan.issue = (
                f"Already has {denied_before} denied requests; preserving existing records "
                f"would exceed the target of {DENIED_TARGET}."
            )
        elif pending_before < PENDING_MIN or denied_before < DENIED_TARGET:
            requester_pool = sorted(
                (user for user in active_users if user.id != owner.id),
                key=lambda user: _stable_order(f"requester:{owner.id}:{user.id}"),
            )[:REQUESTER_POOL_SIZE]
            candidates: list[
                tuple[Document, User, list[dict[str, bool]]]
            ] = []
            for document in documents:
                for requester in requester_pool:
                    pair = (document.id, requester.id)
                    if pair in existing_pairs:
                        continue
                    grants_for_pair = active_grants.get(pair, [])
                    available_permissions = [
                        permissions
                        for permissions in PERMISSION_TYPES
                        if not any(
                            _grant_covers(grant, permissions)
                            for grant in grants_for_pair
                        )
                    ]
                    if available_permissions:
                        candidates.append((document, requester, available_permissions))
            candidates.sort(
                key=lambda candidate: _stable_order(
                    f"pair:{owner.id}:{candidate[0].id}:{candidate[1].id}"
                )
            )

            pending_needed = pending_target - pending_before
            denied_needed = DENIED_TARGET - denied_before
            required = pending_needed + denied_needed
            if len(candidates) < required:
                owner_plan.issue = (
                    f"Only {len(candidates)} eligible requester/document pairs are available "
                    f"for {required} additional requests."
                )
            else:
                slot_seed = int.from_bytes(_stable_order(str(owner.id))[:4], "big")
                for index, (document, requester, available_permissions) in enumerate(
                    candidates[:required]
                ):
                    digest = _stable_order(
                        f"entry:{owner.id}:{document.id}:{requester.id}:{index}"
                    )
                    status = "PENDING" if index < pending_needed else "DENIED"
                    permissions = available_permissions[
                        (slot_seed + index) % len(available_permissions)
                    ].copy()
                    requested_at = now - timedelta(
                        days=1 + int.from_bytes(digest[:2], "big") % 27,
                        minutes=int.from_bytes(digest[2:4], "big") % 1440,
                    )
                    denied = status == "DENIED"
                    owner_plan.entries.append(
                        PlannedRequest(
                            requester=requester,
                            document=document,
                            owner=owner,
                            status=status,
                            permissions=permissions,
                            requested_at=requested_at,
                            decided_at=(
                                requested_at + timedelta(minutes=5 + digest[4] % 56)
                                if denied
                                else None
                            ),
                            reason=(
                                "[DEMO DATA] "
                                + REASONS[(slot_seed + index) % len(REASONS)]
                            ),
                            decision_reason=(
                                DENIAL_REASONS[(slot_seed + index) % len(DENIAL_REASONS)]
                                if denied
                                else None
                            ),
                        )
                    )
        owners.append(owner_plan)

    active_document_owner_ids = set(documents_by_owner)
    all_active_document_owner_ids = set(
        session.execute(
            select(Document.owner_user_id)
            .join(User, User.id == Document.owner_user_id)
            .where(
                Document.status == "ACTIVE",
                Document.deleted_at.is_(None),
                User.account_status == AccountStatus.ACTIVE,
            )
            .distinct()
        ).scalars()
    )
    inactive_document_owners = list(
        session.execute(
            select(User)
            .join(Document, Document.owner_user_id == User.id)
            .where(
                Document.status == "ACTIVE",
                Document.deleted_at.is_(None),
                User.account_status != AccountStatus.ACTIVE,
            )
            .distinct()
        ).scalars()
    )
    all_document_owner_ids = set(
        session.execute(select(Document.owner_user_id).distinct()).scalars()
    )
    users_without_documents = [
        user for user in all_users if user.id not in all_document_owner_ids
    ]
    active_owners_without_available_versions = list(
        session.execute(
            select(User)
            .where(
                User.account_status == AccountStatus.ACTIVE,
                User.id.in_(all_active_document_owner_ids - active_document_owner_ids),
            )
            .order_by(User.email, User.id)
        ).scalars()
    )
    return SeedPlan(
        active_users=active_users,
        owners=owners,
        all_user_count=len(all_users),
        users_without_active_documents=sum(
            user.id not in all_active_document_owner_ids for user in active_users
        ),
        users_without_documents=users_without_documents,
        inactive_document_owners=inactive_document_owners,
        active_owners_without_available_versions=active_owners_without_available_versions,
        existing_status_counts=existing_status_counts,
    )


def _report(plan: SeedPlan, *, dry_run: bool) -> dict[str, Any]:
    added: dict[str, int] = {}
    for entry in plan.entries:
        added[entry.status] = added.get(entry.status, 0) + 1
    return {
        "dry_run": dry_run,
        "database": {
            "host": DB_HOST,
            "name": DB_NAME,
            "credentials_included": False,
        },
        "all_users": plan.all_user_count,
        "active_users": len(plan.active_users),
        "eligible_document_owners": len(plan.owners),
        "users_without_active_documents": plan.users_without_active_documents,
        "users_without_documents": [
            {
                "user_id": str(user.id),
                "user_name": user.full_name,
                "account_status": user.account_status.value,
            }
            for user in plan.users_without_documents
        ],
        "inactive_document_owners_not_seeded": [
            {"user_id": str(user.id), "user_name": user.full_name}
            for user in plan.inactive_document_owners
        ],
        "active_owners_without_available_versions": [
            {"user_id": str(user.id), "user_name": user.full_name}
            for user in plan.active_owners_without_available_versions
        ],
        "existing_requests_by_status": plan.existing_status_counts,
        "planned_new_requests_by_status": added,
        "planned_new_audit_events": sum(
            1 if entry.status == "PENDING" else 2 for entry in plan.entries
        ),
        "planned_new_notifications": len(plan.entries),
        "owner_results": [
            {
                "owner_id": str(owner_plan.owner.id),
                "owner_name": owner_plan.owner.full_name,
                "pending_before": owner_plan.pending_before,
                "pending_target": owner_plan.pending_target,
                "pending_to_insert": sum(
                    entry.status == "PENDING" for entry in owner_plan.entries
                ),
                "denied_before": owner_plan.denied_before,
                "denied_target": owner_plan.denied_target,
                "denied_to_insert": sum(
                    entry.status == "DENIED" for entry in owner_plan.entries
                ),
                "issue": owner_plan.issue,
            }
            for owner_plan in plan.owners
        ],
    }


def _apply(session, plan: SeedPlan) -> None:
    for entry in plan.entries:
        request_id = uuid.uuid4()
        session.add(
            AccessRequest(
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
        )
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
                    "new_status": "PENDING",
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
                title="[DEMO DATA] Document access requested",
                message=(
                    f"[DEMO DATA] {entry.requester.full_name} requested access "
                    f"to {entry.document.title}."
                ),
                preference_key="document_access_requests",
                document_id=entry.document.id,
                metadata={"access_request_id": str(request_id), "seeded_demo_record": True},
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
                title="[DEMO DATA] Document access declined",
                message=f"[DEMO DATA] The request for {entry.document.title} was declined.",
                preference_key="access_request_decisions",
                document_id=entry.document.id,
                metadata={"access_request_id": str(request_id), "seeded_demo_record": True},
            )
    session.flush()


def _label_demo_notifications(session) -> int:
    notifications = session.execute(
        select(Notification).where(
            Notification.metadata_json.contains({"seeded_demo_record": True})
        )
    ).scalars()
    updated = 0
    for notification in notifications:
        if not notification.title.startswith("[DEMO DATA]"):
            notification.title = f"[DEMO DATA] {notification.title}"
            notification.message = f"[DEMO DATA] {notification.message}"
            updated += 1
    return updated


def _verify(session, plan: SeedPlan) -> list[dict[str, Any]]:
    owner_ids = [owner_plan.owner.id for owner_plan in plan.owners]
    actual_counts: dict[uuid.UUID, dict[str, int]] = {}
    if owner_ids:
        rows = session.execute(
            select(Document.owner_user_id, AccessRequest.status, func.count())
            .join(AccessRequest, AccessRequest.document_id == Document.id)
            .where(Document.owner_user_id.in_(owner_ids))
            .group_by(Document.owner_user_id, AccessRequest.status)
        ).all()
        for owner_id, status, count in rows:
            actual_counts.setdefault(owner_id, {})[status] = count

    failures: list[dict[str, Any]] = []
    for owner_plan in plan.owners:
        counts = actual_counts.get(owner_plan.owner.id, {})
        pending = counts.get("PENDING", 0)
        denied = counts.get("DENIED", 0)
        if owner_plan.issue is None and (
            not PENDING_MIN <= pending <= PENDING_MAX
            or denied != DENIED_TARGET
        ):
            failures.append(
                {
                    "owner_id": str(owner_plan.owner.id),
                    "owner_name": owner_plan.owner.full_name,
                    "pending": pending,
                    "denied": denied,
                }
            )
    if failures:
        raise RuntimeError(
            "Per-owner post-seed verification failed: "
            + json.dumps(failures[:10], sort_keys=True)
        )
    return [
        {
            "owner_id": str(owner_plan.owner.id),
            "owner_name": owner_plan.owner.full_name,
            "pending_after": actual_counts.get(owner_plan.owner.id, {}).get(
                "PENDING", 0
            ),
            "denied_after": actual_counts.get(owner_plan.owner.id, {}).get("DENIED", 0),
            "issue": owner_plan.issue,
        }
        for owner_plan in plan.owners
    ]


def _run(args: argparse.Namespace) -> int:
    if DB_HOST not in LOCAL_DB_HOSTS:
        raise RuntimeError(
            "Refusing to seed a non-local database. Verify the target separately "
            "before running this development-data backfill."
        )
    if args.apply and args.confirm_database != DB_NAME:
        raise RuntimeError(
            "Applying changes requires --confirm-database to match the configured database name."
        )

    session = SessionLocal()
    try:
        session.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
        session.execute(text("SET LOCAL lock_timeout = '5s'"))
        session.execute(text("SET LOCAL statement_timeout = '600s'"))
        plan = _build_plan(session)
        report = _report(plan, dry_run=not args.apply)
        if not args.apply:
            session.rollback()
            print(json.dumps(report, indent=2, sort_keys=True))
            return 0
        _apply(session, plan)
        _apply(session, plan)
        report["labeled_demo_notifications"] = _label_demo_notifications(session)
        report["owner_verification"] = _verify(session, plan)
        session.commit()
        report["dry_run"] = False
        report["created_requests"] = len(plan.entries)
        report["created_audit_events"] = sum(
            1 if entry.status == "PENDING" else 2 for entry in plan.entries
        )
        report["created_notifications"] = len(plan.entries)
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
        description=(
            "Plan or insert demo access requests for every active document owner "
            "using existing users and documents."
        )
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview per-owner records without writing (default).",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Insert missing demo requests and related audit/notification records.",
    )
    parser.add_argument(
        "--confirm-database",
        help="Required with --apply; must exactly match the configured local DB name.",
    )
    return _run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
