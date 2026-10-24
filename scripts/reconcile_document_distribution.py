#!/usr/bin/env python3
"""Reconcile document ownership and view-only sharing for active SureDocs users."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import S3_BUCKET  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.documents import Document, DocumentPermission, DocumentVersion  # noqa: E402
from app.models.user import User  # noqa: E402

EXPECTED_ACTIVE_USERS = 705
EXPECTED_DOCUMENTS = 15_032
SHARES_PER_USER = 17
LOCK_NAME = "suredocs-document-distribution-v1"
LOCK_NAMESPACE = 1_261_409_441


class ReconciliationError(RuntimeError):
    """The live database does not satisfy preconditions for safe reconciliation."""


@dataclass(frozen=True)
class Plan:
    users: list[User]
    documents: list[Document]
    owner_by_document: dict[UUID, UUID]
    shares: list[tuple[UUID, UUID]]
    existing_permissions: list[DocumentPermission]
    ownership_changes: int
    new_permissions: int
    total_user_count: int
    version_by_document: dict[UUID, DocumentVersion]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_share_pairs(
    users: list[User],
    documents: list[Document],
    owner_by_document: dict[UUID, UUID],
) -> list[tuple[UUID, UUID]]:
    if len(documents) < SHARES_PER_USER + 1:
        raise ReconciliationError(
            "There are too few documents to grant 17 distinct documents from other owners."
        )

    pairs: list[tuple[UUID, UUID]] = []
    document_count = len(documents)
    for user_index, user in enumerate(users):
        selected: set[UUID] = set()
        offset = (user_index * SHARES_PER_USER) % document_count
        for step in range(document_count):
            document = documents[(offset + step) % document_count]
            if owner_by_document[document.id] == user.id:
                continue
            selected.add(document.id)
            if len(selected) == SHARES_PER_USER:
                break
        if len(selected) != SHARES_PER_USER:
            raise ReconciliationError(
                f"Could not find 17 distinct documents owned by other users for {user.id}."
            )
        pairs.extend((document_id, user.id) for document_id in sorted(selected))
    return pairs


def _make_plan(
    session,
    expected_users: int,
    expected_documents: int,
    *,
    lock_rows: bool,
) -> Plan:
    if lock_rows:
        session.execute(
            text("SELECT pg_advisory_xact_lock(:namespace, hashtext(:lock_name))"),
            {"namespace": LOCK_NAMESPACE, "lock_name": LOCK_NAME},
        )
    all_user_count = session.scalar(select(func.count()).select_from(User)) or 0
    user_query = (
        select(User)
        .where(User.account_status == "ACTIVE")
        .order_by(User.id)
    )
    users = list(session.execute(user_query).scalars())
    if len(users) != expected_users:
        raise ReconciliationError(
            f"Expected {expected_users} active users, found {len(users)}."
        )

    document_query = select(Document).order_by(Document.id)
    if lock_rows:
        document_query = document_query.with_for_update()
    documents = list(session.execute(document_query).scalars())
    if len(documents) != expected_documents:
        raise ReconciliationError(
            f"Expected {expected_documents} documents, found {len(documents)}."
        )
    if any(document.status != "ACTIVE" or document.deleted_at is not None for document in documents):
        raise ReconciliationError(
            "All documents must be active and not soft-deleted; no document was changed."
        )

    version_query = select(DocumentVersion).where(
        DocumentVersion.document_id.in_([document.id for document in documents]),
        DocumentVersion.id.in_(
            [document.current_version_id for document in documents]
        ),
    )
    if lock_rows:
        version_query = version_query.with_for_update()
    versions = list(session.execute(version_query).scalars())
    version_by_document = {version.document_id: version for version in versions}
    if len(version_by_document) != len(documents):
        raise ReconciliationError(
            "At least one document is missing its current version; no document was changed."
        )
    if any(
        document.current_version_id != version_by_document[document.id].id
        or version_by_document[document.id].status != "AVAILABLE"
        or version_by_document[document.id].storage_bucket != S3_BUCKET
        for document in documents
    ):
        raise ReconciliationError(
            "Every current document version must be AVAILABLE in the configured S3 bucket."
        )

    base_count, remainder = divmod(len(documents), len(users))
    owner_by_document: dict[UUID, UUID] = {}
    cursor = 0
    for user_index, user in enumerate(users):
        allocation = base_count + (1 if user_index < remainder else 0)
        for document in documents[cursor : cursor + allocation]:
            owner_by_document[document.id] = user.id
        cursor += allocation
    if cursor != len(documents):
        raise ReconciliationError("Ownership allocation did not cover every document.")

    shares = _build_share_pairs(users, documents, owner_by_document)
    desired_pairs = set(shares)
    if len(desired_pairs) != expected_users * SHARES_PER_USER:
        raise ReconciliationError("The planned recipient/document pairs are not unique.")

    permission_query = select(DocumentPermission).order_by(
        DocumentPermission.document_id, DocumentPermission.user_id
    )
    if lock_rows:
        permission_query = permission_query.with_for_update()
    existing_permissions = list(session.execute(permission_query).scalars())
    for permission in existing_permissions:
        pair = (permission.document_id, permission.user_id)
        if pair not in desired_pairs:
            raise ReconciliationError(
                "An existing permission is outside the required sharing plan. "
                "It will not be revoked or deleted automatically."
            )
        if (
            permission.revoked_at is not None
            or permission.expires_at is not None
            or not permission.can_view
            or permission.can_download
            or permission.can_edit
            or permission.granted_by_user_id
            != owner_by_document[permission.document_id]
        ):
            raise ReconciliationError(
                "An existing permission is revoked, expiring, not view-only, or has "
                "a different grantor. It will not be changed automatically."
            )
    return Plan(
        users=users,
        documents=documents,
        owner_by_document=owner_by_document,
        shares=shares,
        existing_permissions=existing_permissions,
        ownership_changes=sum(
            document.owner_user_id != owner_by_document[document.id]
            for document in documents
        ),
        new_permissions=len(desired_pairs)
        - len(existing_permissions),
        total_user_count=all_user_count,
        version_by_document=version_by_document,
    )


def _validate_database(session, plan: Plan) -> dict[str, Any]:
    user_count = session.scalar(
        select(func.count()).select_from(User).where(User.account_status == "ACTIVE")
    )
    document_count = session.scalar(select(func.count()).select_from(Document))
    ownership_count = session.scalar(
        select(func.count()).select_from(Document).where(Document.owner_user_id.is_not(None))
    )
    permission_count = session.scalar(
        select(func.count()).select_from(DocumentPermission)
    )
    distinct_permission_pairs = (
        select(
            DocumentPermission.document_id,
            DocumentPermission.user_id,
        )
        .group_by(DocumentPermission.document_id, DocumentPermission.user_id)
        .subquery()
    )
    distinct_permissions = session.scalar(
        select(func.count()).select_from(distinct_permission_pairs)
    )

    owner_rows = session.execute(
        select(Document.owner_user_id, func.count(Document.id))
        .group_by(Document.owner_user_id)
    ).all()
    owned_counts = {user_id: count for user_id, count in owner_rows}

    now = _utc_now()
    effective_rows = session.execute(
        select(
            DocumentPermission.user_id,
            func.count(func.distinct(DocumentPermission.document_id)),
        )
        .join(Document, Document.id == DocumentPermission.document_id)
        .where(
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            DocumentPermission.can_view.is_(True),
            Document.status == "ACTIVE",
            Document.deleted_at.is_(None),
            Document.owner_user_id != DocumentPermission.user_id,
        )
        .group_by(DocumentPermission.user_id)
    ).all()
    shared_counts = {user_id: count for user_id, count in effective_rows}

    active_user_ids = {user.id for user in plan.users}
    owner_distribution = Counter(
        owned_counts.get(user_id, 0) for user_id in active_user_ids
    )
    users_with_expected_shares = sum(
        shared_counts.get(user_id, 0) == SHARES_PER_USER
        for user_id in active_user_ids
    )
    self_shares = session.scalar(
        select(func.count())
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .where(DocumentPermission.user_id == Document.owner_user_id)
    )
    duplicate_groups = session.scalar(
        select(func.count())
        .select_from(
            select(
                DocumentPermission.document_id,
                DocumentPermission.user_id,
            )
            .group_by(DocumentPermission.document_id, DocumentPermission.user_id)
            .having(func.count() > 1)
            .subquery()
        )
    )
    docs_with_invalid_owner = session.scalar(
        select(func.count())
        .select_from(Document)
        .outerjoin(User, User.id == Document.owner_user_id)
        .where(User.id.is_(None))
    )
    multi_owner_documents = (
        select(Document.id)
        .group_by(Document.id)
        .having(func.count(func.distinct(Document.owner_user_id)) > 1)
        .subquery()
    )
    docs_with_multiple_owners = session.scalar(
        select(func.count()).select_from(multi_owner_documents)
    )
    effective_share_pairs = (
        select(
            DocumentPermission.document_id,
            DocumentPermission.user_id,
        )
        .join(Document, Document.id == DocumentPermission.document_id)
        .where(
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            DocumentPermission.can_view.is_(True),
            Document.status == "ACTIVE",
            Document.deleted_at.is_(None),
            Document.owner_user_id != DocumentPermission.user_id,
        )
        .distinct()
        .subquery()
    )
    effective_sharing_relationships = session.scalar(
        select(func.count()).select_from(effective_share_pairs)
    )

    result = {
        "total_users_in_database": plan.total_user_count,
        "active_users_in_distribution": user_count,
        "total_unique_documents": document_count,
        "ownership_relationships": ownership_count,
        "users_owning_21_documents": owner_distribution.get(21, 0),
        "users_owning_22_documents": owner_distribution.get(22, 0),
        "users_with_17_distinct_effective_shared_documents": users_with_expected_shares,
        "distinct_document_sharing_relationships": distinct_permissions,
        "distinct_effective_document_sharing_relationships": effective_sharing_relationships,
        "total_permission_rows": permission_count,
        "documents_with_more_than_one_owner": docs_with_multiple_owners,
        "documents_with_invalid_owner": docs_with_invalid_owner,
        "self_sharing_relationships": self_shares,
        "duplicate_recipient_document_relationships": duplicate_groups,
        "view_only_permission_rows": session.scalar(
            select(func.count())
            .select_from(DocumentPermission)
            .where(
                DocumentPermission.can_view.is_(True),
                DocumentPermission.can_download.is_(False),
                DocumentPermission.can_edit.is_(False),
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.expires_at.is_(None),
            )
        ),
        "owned_document_counts_exact": all(
            owned_counts.get(user_id) == 21
            or owned_counts.get(user_id) == 22
            for user_id in active_user_ids
        ),
        "shared_document_counts_exact": users_with_expected_shares
        == len(active_user_ids),
    }

    expected_remainder = len(plan.documents) % len(plan.users)
    expected_base = len(plan.documents) // len(plan.users)
    expected_ownership_distribution = {
        expected_base: len(plan.users) - expected_remainder,
        expected_base + 1: expected_remainder,
    }
    actual_ownership_distribution = {
        count: owner_distribution.get(count, 0)
        for count in expected_ownership_distribution
    }
    result["ownership_distribution_matches_plan"] = (
        actual_ownership_distribution == expected_ownership_distribution
    )
    passed = (
        user_count == len(plan.users)
        and document_count == len(plan.documents)
        and ownership_count == len(plan.documents)
        and permission_count == len(plan.users) * SHARES_PER_USER
        and distinct_permissions == permission_count
        and effective_sharing_relationships
        == len(plan.users) * SHARES_PER_USER
        and users_with_expected_shares == len(plan.users)
        and self_shares == 0
        and duplicate_groups == 0
        and docs_with_invalid_owner == 0
        and result["ownership_distribution_matches_plan"]
        and result["view_only_permission_rows"] == permission_count
    )
    result["validation_passed"] = bool(passed)
    if not passed:
        raise ReconciliationError(
            f"Post-reconciliation SQL validation failed: {json.dumps(result, default=str)}"
        )
    return result


def _apply_plan(session, plan: Plan) -> None:
    now = _utc_now()
    for document in plan.documents:
        new_owner_id = plan.owner_by_document[document.id]
        if document.owner_user_id != new_owner_id:
            document.owner_user_id = new_owner_id
            document.updated_at = now
    session.flush()

    existing_pairs = {
        (permission.document_id, permission.user_id)
        for permission in plan.existing_permissions
    }
    users_by_id = {user.id: user for user in plan.users}
    documents_by_id = {document.id: document for document in plan.documents}
    for document_id, recipient_id in plan.shares:
        if (document_id, recipient_id) in existing_pairs:
            continue
        owner_id = plan.owner_by_document[document_id]
        if owner_id == recipient_id:
            raise ReconciliationError("Refusing to create a self-sharing permission.")
        if owner_id not in users_by_id or recipient_id not in users_by_id:
            raise ReconciliationError("A permission owner or recipient is not active.")
        document = documents_by_id[document_id]
        if document.status != "ACTIVE" or document.deleted_at is not None:
            raise ReconciliationError("Refusing to share an inactive document.")
        session.add(
            DocumentPermission(
                document_id=document_id,
                user_id=recipient_id,
                can_view=True,
                can_download=False,
                can_edit=False,
                granted_by_user_id=owner_id,
                granted_at=now,
                expires_at=None,
                revoked_at=None,
            )
        )
    session.flush()


def _execute(args: argparse.Namespace) -> int:
    session = SessionLocal()
    try:
        session.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
        session.execute(text("SET LOCAL lock_timeout = '5s'"))
        session.execute(text("SET LOCAL statement_timeout = '180s'"))
        plan = _make_plan(
            session,
            args.expected_users,
            args.expected_documents,
            lock_rows=not args.dry_run,
        )
        if args.dry_run:
            print(
                json.dumps(
                    {
                        "dry_run": True,
                        "total_users_in_database": plan.total_user_count,
                        "active_users_in_distribution": len(plan.users),
                        "total_documents": len(plan.documents),
                        "ownership_distribution": {
                            str(len(plan.documents) // len(plan.users)): len(plan.users)
                            - len(plan.documents) % len(plan.users),
                            str(len(plan.documents) // len(plan.users) + 1): len(plan.documents)
                            % len(plan.users),
                        },
                        "ownership_changes": plan.ownership_changes,
                        "existing_permissions": len(plan.existing_permissions),
                        "new_view_only_permissions": plan.new_permissions,
                        "total_sharing_relationships": len(plan.shares),
                        "total_current_versions_available": len(plan.version_by_document),
                        "s3_bucket": S3_BUCKET,
                        "database_changes": False,
                    },
                    indent=2,
                    sort_keys=True,
                )
            )
            session.rollback()
            return 0

        _apply_plan(session, plan)
        result = _validate_database(session, plan)
        session.commit()
        print(
            json.dumps(
                {
                    "dry_run": False,
                    "ownership_changes": plan.ownership_changes,
                    "new_permissions_created": plan.new_permissions,
                    "result": result,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    except (ReconciliationError, SQLAlchemyError) as exc:
        session.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Give each active user 17 view-only shares and balance ownership "
            "across the configured active-user population."
        )
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Report the reconciled plan without changing the database (default).",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Apply the entire reconciliation in one locked transaction.",
    )
    parser.add_argument(
        "--expected-users",
        type=int,
        default=EXPECTED_ACTIVE_USERS,
        help=f"Required active users; default {EXPECTED_ACTIVE_USERS}.",
    )
    parser.add_argument(
        "--expected-documents",
        type=int,
        default=EXPECTED_DOCUMENTS,
        help=f"Required total documents; default {EXPECTED_DOCUMENTS}.",
    )
    args = parser.parse_args()
    if args.expected_users < 1 or args.expected_documents < 1:
        parser.error("Expected user and document counts must be positive.")
    args.dry_run = not args.apply
    return _execute(args)


if __name__ == "__main__":
    raise SystemExit(main())
