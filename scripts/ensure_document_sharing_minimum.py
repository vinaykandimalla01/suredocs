#!/usr/bin/env python3
"""Add missing, varied permission grants so every eligible document has five recipients."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import S3_BUCKET  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.documents import Document, DocumentPermission, DocumentVersion  # noqa: E402
from app.models.user import User  # noqa: E402

MINIMUM_RECIPIENTS = 5
ADVISORY_LOCK_KEY = 6_834_521_770_293_441_207
PERMISSION_COMBINATIONS = (
    (True, False, False),
    (True, True, False),
    (True, False, True),
    (True, True, True),
)


class SharingPlanError(RuntimeError):
    """The database state is not safe to reconcile automatically."""


@dataclass(frozen=True)
class GrantPlan:
    document: Document
    recipient: User
    permission: tuple[bool, bool, bool]


@dataclass(frozen=True)
class Plan:
    users: list[User]
    documents: list[Document]
    eligible_documents: list[Document]
    current_versions: dict[UUID, DocumentVersion]
    existing_permissions: list[DocumentPermission]
    grants_to_add: list[GrantPlan]
    skipped_document_ids: list[UUID]
    active_recipient_counts: dict[UUID, int]
    effective_sharing_counts: Counter[tuple[bool, bool, bool]]
    permission_pair_counts: Counter[tuple[bool, bool, bool]]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_plan(session, *, lock_rows: bool) -> Plan:
    session.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": ADVISORY_LOCK_KEY},
    )

    users_query = (
        select(User)
        .where(User.account_status == "ACTIVE")
        .order_by(User.id)
    )
    users = list(session.execute(users_query).scalars())
    if len(users) < MINIMUM_RECIPIENTS + 1:
        raise SharingPlanError(
            f"Only {len(users)} active users exist; at least "
            f"{MINIMUM_RECIPIENTS + 1} are required."
        )
    users_by_id = {user.id: user for user in users}

    documents_query = select(Document).order_by(Document.id)
    if lock_rows:
        documents_query = documents_query.with_for_update()
    documents = list(session.execute(documents_query).scalars())
    document_ids = [document.id for document in documents]

    versions_query = select(DocumentVersion).where(
        DocumentVersion.document_id.in_(document_ids)
    )
    if lock_rows:
        versions_query = versions_query.with_for_update()
    versions = list(session.execute(versions_query).scalars())
    current_versions = {
        version.document_id: version
        for version in versions
        if version.id
        in {
            document.current_version_id
            for document in documents
            if document.current_version_id is not None
        }
    }

    eligible_documents: list[Document] = []
    skipped_document_ids: list[UUID] = []
    for document in documents:
        owner = users_by_id.get(document.owner_user_id)
        version = current_versions.get(document.id)
        eligible = (
            owner is not None
            and document.status == "ACTIVE"
            and document.deleted_at is None
            and version is not None
            and version.document_id == document.id
            and version.status == "AVAILABLE"
            and version.storage_bucket == S3_BUCKET
            and bool(version.storage_key)
        )
        if eligible:
            eligible_documents.append(document)
        else:
            skipped_document_ids.append(document.id)

    permissions_query = select(DocumentPermission).order_by(
        DocumentPermission.document_id, DocumentPermission.user_id
    )
    if lock_rows:
        permissions_query = permissions_query.with_for_update()
    existing_permissions = list(session.execute(permissions_query).scalars())

    existing_by_pair = {
        (permission.document_id, permission.user_id): permission
        for permission in existing_permissions
    }
    document_by_id = {document.id: document for document in eligible_documents}
    active_recipients: dict[UUID, set[UUID]] = defaultdict(set)
    active_permissions_by_doc: dict[UUID, list[tuple[bool, bool, bool]]] = defaultdict(list)
    now = _now()
    for permission in existing_permissions:
        document = document_by_id.get(permission.document_id)
        recipient = users_by_id.get(permission.user_id)
        if (
            document is not None
            and recipient is not None
            and permission.user_id != document.owner_user_id
            and permission.revoked_at is None
            and (permission.expires_at is None or permission.expires_at > now)
            and permission.can_view
        ):
            active_recipients[document.id].add(recipient.id)
            active_permissions_by_doc[document.id].append(
                (permission.can_view, permission.can_download, permission.can_edit)
            )

    initial_active_recipient_counts = {
        document_id: len(recipient_ids)
        for document_id, recipient_ids in active_recipients.items()
    }
    grants_to_add: list[GrantPlan] = []
    for document_index, document in enumerate(eligible_documents):
        selected_recipients = active_recipients[document.id]
        missing = max(0, MINIMUM_RECIPIENTS - len(selected_recipients))
        if not missing:
            continue
        blocked_recipients = {
            user_id
            for doc_id, user_id in existing_by_pair
            if doc_id == document.id
        }
        start_index = int.from_bytes(
            hashlib.sha256(document.id.bytes).digest()[:8], "big"
        ) % len(users)
        candidates = [
            users[(start_index + offset) % len(users)]
            for offset in range(len(users))
        ]
        used_combinations = set(active_permissions_by_doc[document.id])
        new_combinations: list[tuple[bool, bool, bool]] = []
        for combination in PERMISSION_COMBINATIONS:
            if combination not in used_combinations:
                new_combinations.append(combination)
        for combination in PERMISSION_COMBINATIONS:
            if len(new_combinations) >= missing:
                break
            new_combinations.append(combination)

        added = 0
        for recipient in candidates:
            if recipient.id == document.owner_user_id:
                continue
            if recipient.id in selected_recipients or recipient.id in blocked_recipients:
                continue
            permission = new_combinations[added]
            grants_to_add.append(
                GrantPlan(document, recipient, permission)
            )
            selected_recipients.add(recipient.id)
            added += 1
            if added == missing:
                break
        if added != missing:
            raise SharingPlanError(
                f"Only {added} missing recipients could be selected for "
                f"document {document.id}; it will not be modified."
            )
        if document_index and document_index % 5000 == 0:
            print(
                f"Planned {document_index}/{len(eligible_documents)} documents",
                flush=True,
            )

    effective_sharing_counts: Counter[tuple[bool, bool, bool]] = Counter()
    permission_pair_counts: Counter[tuple[bool, bool, bool]] = Counter()
    for permissions in active_permissions_by_doc.values():
        effective_sharing_counts.update(permissions)
        permission_pair_counts.update(permissions)
    for grant in grants_to_add:
        effective_sharing_counts[grant.permission] += 1
        permission_pair_counts[grant.permission] += 1

    return Plan(
        users=users,
        documents=documents,
        eligible_documents=eligible_documents,
        current_versions=current_versions,
        existing_permissions=existing_permissions,
        grants_to_add=grants_to_add,
        skipped_document_ids=skipped_document_ids,
        active_recipient_counts={
            document_id: count
            for document_id, count in initial_active_recipient_counts.items()
        },
        effective_sharing_counts=effective_sharing_counts,
        permission_pair_counts=permission_pair_counts,
    )


def _validate(session, plan: Plan) -> dict[str, Any]:
    now = _now()
    eligible_ids = [document.id for document in plan.eligible_documents]
    active_counts = session.execute(
        select(
            DocumentPermission.document_id,
            DocumentPermission.user_id,
        )
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(User, User.id == DocumentPermission.user_id)
        .where(
            DocumentPermission.document_id.in_(eligible_ids),
            User.account_status == "ACTIVE",
            DocumentPermission.user_id != Document.owner_user_id,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            Document.status == "ACTIVE",
            Document.deleted_at.is_(None),
        )
        .distinct()
    ).all()
    recipients_per_document: Counter[UUID] = Counter(
        document_id for document_id, _ in active_counts
    )
    below_minimum = {
        document.id: recipients_per_document.get(document.id, 0)
        for document in plan.eligible_documents
        if recipients_per_document.get(document.id, 0) < MINIMUM_RECIPIENTS
    }
    self_shares = session.scalar(
        select(text("count(*)"))
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .where(DocumentPermission.user_id == Document.owner_user_id)
    ) or 0
    duplicate_pairs = session.scalar(
        select(text("count(*)")).select_from(
            select(
                DocumentPermission.document_id,
                DocumentPermission.user_id,
            )
            .group_by(DocumentPermission.document_id, DocumentPermission.user_id)
            .having(text("count(*) > 1"))
            .subquery()
        )
    ) or 0
    active_permission_rows = session.execute(
        select(
            DocumentPermission.can_view,
            DocumentPermission.can_download,
            DocumentPermission.can_edit,
        )
        .join(Document, Document.id == DocumentPermission.document_id)
        .join(User, User.id == DocumentPermission.user_id)
        .where(
            DocumentPermission.document_id.in_(eligible_ids),
            User.account_status == "ACTIVE",
            DocumentPermission.user_id != Document.owner_user_id,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            Document.status == "ACTIVE",
            Document.deleted_at.is_(None),
        )
    ).all()
    combinations = Counter(tuple(row) for row in active_permission_rows)

    result = {
        "total_users": session.scalar(select(text("count(*)")).select_from(User)),
        "active_users": len(plan.users),
        "total_documents": session.scalar(
            select(text("count(*)")).select_from(Document)
        ),
        "eligible_documents": len(plan.eligible_documents),
        "skipped_documents": len(plan.skipped_document_ids),
        "total_permission_rows": session.scalar(
            select(text("count(*)")).select_from(DocumentPermission)
        ),
        "active_sharing_relationships": len(active_counts),
        "documents_with_at_least_five_active_recipients": len(
            plan.eligible_documents
        )
        - len(below_minimum),
        "documents_below_minimum": len(below_minimum),
        "self_sharing_relationships": int(self_shares),
        "duplicate_document_recipient_pairs": int(duplicate_pairs),
        "effective_permission_combinations": {
            "read": combinations.get((True, False, False), 0),
            "read_download": combinations.get((True, True, False), 0),
            "read_edit": combinations.get((True, False, True), 0),
            "read_download_edit": combinations.get((True, True, True), 0),
        },
        "validation_passed": not below_minimum and not self_shares and not duplicate_pairs,
    }
    if below_minimum or self_shares or duplicate_pairs:
        raise SharingPlanError(
            "Post-apply validation failed: "
            + json.dumps(result, sort_keys=True)
            + f"; under-minimum sample={list(below_minimum.items())[:10]}"
        )
    return result


def _run(args: argparse.Namespace) -> int:
    session = SessionLocal()
    try:
        session.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
        session.execute(text("SET LOCAL lock_timeout = '5s'"))
        session.execute(text("SET LOCAL statement_timeout = '300s'"))
        plan = _build_plan(session, lock_rows=args.apply)
        initial_active = sum(
            plan.active_recipient_counts.values()
        )
        report = {
            "dry_run": not args.apply,
            "total_users": session.scalar(
                select(text("count(*)")).select_from(User)
            ),
            "active_users": len(plan.users),
            "total_documents": len(plan.documents),
            "eligible_documents": len(plan.eligible_documents),
            "skipped_documents": len(plan.skipped_document_ids),
            "current_active_sharing_relationships": initial_active,
            "planned_new_grants": len(plan.grants_to_add),
            "projected_active_sharing_relationships": initial_active
            + len(plan.grants_to_add),
            "permission_combinations_after_apply": {
                "read": plan.effective_sharing_counts.get(
                    (True, False, False), 0
                ),
                "read_download": plan.effective_sharing_counts.get(
                    (True, True, False), 0
                ),
                "read_edit": plan.effective_sharing_counts.get(
                    (True, False, True), 0
                ),
                "read_download_edit": plan.effective_sharing_counts.get(
                    (True, True, True), 0
                ),
            },
            "errors": [],
        }
        if not args.apply:
            print(json.dumps(report, indent=2, sort_keys=True))
            session.rollback()
            return 0

        now = _now()
        for index, grant in enumerate(plan.grants_to_add, start=1):
            can_view, can_download, can_edit = grant.permission
            session.add(
                DocumentPermission(
                    document_id=grant.document.id,
                    user_id=grant.recipient.id,
                    can_view=can_view,
                    can_download=can_download,
                    can_edit=can_edit,
                    granted_by_user_id=grant.document.owner_user_id,
                    granted_at=now,
                    expires_at=None,
                    revoked_at=None,
                )
            )
            if index % 1000 == 0:
                session.flush()
                print(
                    f"Persisted {index}/{len(plan.grants_to_add)} grants in transaction",
                    flush=True,
                )
        session.flush()
        validation = _validate(session, plan)
        session.commit()
        report.update(
            {
                "dry_run": False,
                "created_grants": len(plan.grants_to_add),
                "validation": validation,
            }
        )
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (SharingPlanError, SQLAlchemyError) as exc:
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
            "Add missing effective document grants without changing existing "
            "ownership or revoking existing permission records."
        )
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Report required additions without writing (default).",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Apply grants and validation in one transaction.",
    )
    args = parser.parse_args()
    args.apply = bool(args.apply)
    return _run(args)


if __name__ == "__main__":
    raise SystemExit(main())
