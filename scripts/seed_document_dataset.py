#!/usr/bin/env python3
"""Idempotently seed uniquely named document copies into SureDocs."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID, uuid5

from botocore.exceptions import ClientError
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import MAX_DOCUMENT_SIZE_BYTES, S3_BUCKET  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.documents import Document, DocumentVersion  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.routers.documents import _FILE_TYPES, _validate_content  # noqa: E402
from app.services.antivirus import scan_document_bytes  # noqa: E402
from app.services.s3_storage import (  # noqa: E402
    StorageUnavailableError,
    delete_document_object,
    get_s3_client,
    put_document,
)
from bulk_import_documents import _guess_category, _guess_classification  # noqa: E402

DATASET_ID = "documents-15000-v1"
UUID_NAMESPACE = UUID("bc07a5e3-c8d8-49a6-951c-e486402c795c")
DEFAULT_TARGET = 15_000
MAX_WORKERS = 16


@dataclass(frozen=True)
class Source:
    path: Path
    relative_path: str
    filename: str
    content: bytes
    content_type: str
    extension: str
    checksum: str


@dataclass(frozen=True)
class Item:
    ordinal: int
    copy_number: int
    source: Source
    document_id: UUID
    version_id: UUID
    filename: str
    title: str
    object_key: str


class SeedError(RuntimeError):
    """The current item cannot safely be reconciled or uploaded."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_sources(root: Path) -> list[Source]:
    if not root.is_dir():
        raise SeedError(f"Source directory does not exist: {root}")
    paths = [
        path
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.name.lower() != "manifest.csv"
    ]
    sources: list[Source] = []
    for path in paths:
        content = path.read_bytes()
        if len(content) > MAX_DOCUMENT_SIZE_BYTES:
            raise SeedError(
                f"{path.name} is {len(content)} bytes, exceeding the "
                f"{MAX_DOCUMENT_SIZE_BYTES}-byte upload limit."
            )
        declared_type = _FILE_TYPES.get(path.suffix.lower())
        if declared_type is None:
            raise SeedError(f"Unsupported source extension: {path.name}")
        content_type, extension = _validate_content(
            path.name, declared_type[0], content
        )
        sources.append(
            Source(
                path=path,
                relative_path=path.relative_to(root).as_posix(),
                filename=path.name,
                content=content,
                content_type=content_type,
                extension=extension,
                checksum=hashlib.sha256(content).hexdigest(),
            )
        )
    if not sources:
        raise SeedError(f"No source documents found in {root}.")
    if len({source.checksum for source in sources}) != len(sources):
        raise SeedError("Source files are not content-unique; refusing ambiguous mapping.")
    return sources


def _items(sources: list[Source], target: int) -> list[Item]:
    items: list[Item] = []
    for ordinal in range(target):
        source = sources[ordinal % len(sources)]
        copy_number = ordinal // len(sources)
        identity = f"{DATASET_ID}:{source.relative_path}:{source.checksum}:{copy_number}"
        document_id = uuid5(UUID_NAMESPACE, identity)
        version_id = uuid5(UUID_NAMESPACE, f"version:{identity}")
        suffix = f"_{document_id.hex[:12]}.{source.extension}"
        title_stem = source.path.stem.replace("_", " ").replace("-", " ").strip()
        title = f"{title_stem or 'Document'} {document_id.hex[:12]}"[:255]
        filename = f"{source.path.stem[: max(1, 255 - len(suffix))]}{suffix}"
        items.append(
            Item(
                ordinal=ordinal,
                copy_number=copy_number,
                source=source,
                document_id=document_id,
                version_id=version_id,
                filename=filename,
                title=title,
                object_key=(
                    f"documents/{document_id}/versions/{version_id}/content"
                ),
            )
        )
    return items


def _select_owner(
    session, owner_email: str | None, target_records: dict[UUID, Document]
) -> User:
    query = select(User).where(User.account_status == "ACTIVE")
    if owner_email:
        query = query.where(User.email.ilike(owner_email.strip()))
        owner = session.execute(query).scalar_one_or_none()
        if owner is None:
            raise SeedError("The requested owner email does not identify an active user.")
        return owner
    existing_owner_ids = {record.owner_user_id for record in target_records.values()}
    if existing_owner_ids:
        if len(existing_owner_ids) != 1:
            raise SeedError(
                "Existing dataset records have multiple owners; specify --owner-email."
            )
        owner = session.get(User, next(iter(existing_owner_ids)))
        if owner is None or owner.account_status != "ACTIVE":
            raise SeedError("The existing dataset owner is no longer active.")
        return owner
    owner = session.execute(
        query.where(User.role == UserRole.ADMIN).order_by(User.created_at.asc())
    ).scalars().first()
    if owner is None:
        raise SeedError("No active administrator is available as the document owner.")
    return owner


def _source_hashes_in_s3(client, sources: list[Source]) -> int:
    expected_hex = {source.checksum.lower() for source in sources}
    expected_base64 = {
        base64.b64encode(bytes.fromhex(source.checksum)).decode("ascii")
        for source in sources
    }
    found = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix="documents/"):
        for object_info in page.get("Contents", []):
            response = client.head_object(
                Bucket=S3_BUCKET,
                Key=object_info["Key"],
                ChecksumMode="ENABLED",
            )
            checksum_metadata = response.get("Metadata", {}).get("sha256", "")
            if (
                checksum_metadata.lower() in expected_hex
                or checksum_metadata in expected_base64
            ):
                found += 1
    return found


def _target_documents(session) -> dict[UUID, Document]:
    records = session.execute(
        select(Document).where(
            Document.custom_metadata["bulk_seed"]["dataset_id"].astext == DATASET_ID
        )
    ).scalars()
    return {record.id: record for record in records}


def _target_versions(session, items: list[Item]) -> dict[UUID, DocumentVersion]:
    versions = session.execute(
        select(DocumentVersion).where(
            DocumentVersion.id.in_([item.version_id for item in items])
        )
    ).scalars()
    return {version.id: version for version in versions}


def _expected_checksum(item: Item) -> str:
    return base64.b64encode(bytes.fromhex(item.source.checksum)).decode("ascii")


def _head_if_present(client, item: Item) -> dict[str, Any] | None:
    try:
        return client.head_object(
            Bucket=S3_BUCKET,
            Key=item.object_key,
            ChecksumMode="ENABLED",
        )
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        status_code = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if code in {"404", "NoSuchKey", "NotFound"} or status_code == 404:
            return None
        raise SeedError(
            f"S3 preflight failed for {item.object_key}: {code or type(exc).__name__}"
        ) from exc


def _verify_object(client, item: Item, head: dict[str, Any]) -> str | None:
    expected_checksum = _expected_checksum(item)
    if (
        head.get("ContentLength") != len(item.source.content)
        or head.get("Metadata", {}).get("sha256") != expected_checksum
    ):
        raise SeedError(
            f"Existing S3 key does not match the expected item; it will not be overwritten: "
            f"{item.object_key}"
        )
    stored_checksum = head.get("ChecksumSHA256")
    if stored_checksum and stored_checksum != expected_checksum:
        raise SeedError(f"S3 checksum mismatch for {item.object_key}.")
    if not stored_checksum:
        response = client.get_object(Bucket=S3_BUCKET, Key=item.object_key)
        body = response["Body"]
        try:
            digest = hashlib.sha256(body.read()).hexdigest()
        finally:
            body.close()
        if digest != item.source.checksum:
            raise SeedError(f"S3 content checksum mismatch for {item.object_key}.")
    return head.get("VersionId")


def _validate_existing_document(document: Document, item: Item) -> None:
    marker = (document.custom_metadata or {}).get("bulk_seed", {})
    if (
        marker.get("dataset_id") != DATASET_ID
        or marker.get("source_sha256") != item.source.checksum
        or marker.get("source_relative_path") != item.source.relative_path
        or marker.get("copy_number") != item.copy_number
    ):
        raise SeedError(
            f"Document ID collision for {item.document_id}; refusing to modify it."
        )
    if document.title != item.title:
        raise SeedError(f"Document title mismatch for {item.document_id}.")
    if (
        marker.get("owner_user_id") != str(document.owner_user_id)
        or document.created_by_user_id != document.owner_user_id
    ):
        raise SeedError(f"Owner metadata mismatch for {item.document_id}.")
    if document.current_version_id not in (None, item.version_id):
        raise SeedError(
            f"Seeded document {item.document_id} points at an unexpected version."
        )


def _build_records(item: Item, owner: User) -> tuple[Document, DocumentVersion]:
    now = _now()
    document = Document(
        id=item.document_id,
        owner_user_id=owner.id,
        created_by_user_id=owner.id,
        title=item.title,
        description=f"Seeded copy of source document {item.source.filename}.",
        category=_guess_category(item.source.filename, None),
        classification=_guess_classification(item.source.filename, None),
        department=owner.department,
        status="ACTIVE",
        custom_metadata={
            "source_file": item.source.filename,
            "source_folder": "documents",
            "import_origin": DATASET_ID,
            "bulk_seed": {
                "dataset_id": DATASET_ID,
                "source_relative_path": item.source.relative_path,
                "source_sha256": item.source.checksum,
                "copy_number": item.copy_number,
                "owner_user_id": str(owner.id),
            },
        },
        created_at=now,
        updated_at=now,
    )
    version = DocumentVersion(
        id=item.version_id,
        document_id=item.document_id,
        version_number=1,
        storage_bucket=S3_BUCKET,
        storage_key=item.object_key,
        original_filename=item.filename,
        file_extension=item.source.extension,
        content_type=item.source.content_type,
        size_bytes=len(item.source.content),
        checksum_sha256=item.source.checksum,
        status="PENDING_UPLOAD",
        uploaded_by_user_id=owner.id,
        uploaded_at=now,
        created_at=now,
    )
    return document, version


def _check_existing_version(version: DocumentVersion, item: Item) -> None:
    if (
        version.document_id != item.document_id
        or version.storage_bucket != S3_BUCKET
        or version.storage_key != item.object_key
        or version.checksum_sha256.lower() != item.source.checksum
        or version.size_bytes != len(item.source.content)
        or version.content_type != item.source.content_type
        or version.original_filename != item.filename
        or version.file_extension != item.source.extension
    ):
        raise SeedError(
            f"Version ID collision or metadata mismatch for {item.version_id}."
        )
    if version.status in {"QUARANTINED", "PURGE_PENDING", "PURGED"}:
        raise SeedError(
            f"Refusing to reactivate version {item.version_id} in state {version.status}."
        )


def _seed_one(item: Item, owner_id: UUID) -> tuple[str, str]:
    client = get_s3_client()
    session = SessionLocal()
    try:
        owner = session.get(User, owner_id)
        if owner is None or owner.account_status != "ACTIVE":
            raise SeedError("The selected document owner is no longer active.")
        document = session.get(Document, item.document_id)
        version = session.get(DocumentVersion, item.version_id)
        if document is not None:
            _validate_existing_document(document, item)
            if document.owner_user_id != owner_id or document.created_by_user_id != owner_id:
                raise SeedError(
                    f"Ownership mismatch for seeded document {item.document_id}."
                )
        if version is not None:
            _check_existing_version(version, item)
            if version.uploaded_by_user_id != owner_id:
                raise SeedError(
                    f"Uploader mismatch for seeded version {item.version_id}."
                )
        elif document is not None:
            raise SeedError(
                f"Seeded document {item.document_id} exists without its expected version."
            )

        existing_head = _head_if_present(client, item)
        existing_s3_version = (
            _verify_object(client, item, existing_head)
            if existing_head is not None
            else None
        )
        if document is None or version is None:
            document, version = _build_records(item, owner)
            session.add_all([document, version])
            session.commit()

        if existing_head is not None:
            if (
                version.status == "AVAILABLE"
                and document.current_version_id == version.id
                and version.s3_version_id == existing_s3_version
                and version.scan_completed_at is not None
            ):
                return "skipped", item.object_key
            version.status = "AVAILABLE"
            version.s3_version_id = existing_s3_version
            version.scan_completed_at = version.scan_completed_at or _now()
            document.current_version_id = version.id
            document.updated_at = _now()
            session.commit()
            return "reconciled", item.object_key

        version.status = "PENDING_UPLOAD"
        session.commit()
        encoded_checksum = _expected_checksum(item)
        try:
            s3_version_id = put_document(
                item.object_key,
                BytesIO(item.source.content),
                content_type=item.source.content_type,
                checksum_sha256=encoded_checksum,
            )
        except StorageUnavailableError as exc:
            try:
                version.status = "FAILED"
                session.commit()
            except SQLAlchemyError:
                session.rollback()
            raise SeedError(f"S3 upload failed for {item.object_key}: {exc}") from exc
        try:
            version.status = "AVAILABLE"
            version.s3_version_id = s3_version_id
            version.scan_completed_at = _now()
            document.current_version_id = version.id
            document.updated_at = _now()
            session.commit()
        except SQLAlchemyError:
            session.rollback()
            cleanup_message = ""
            try:
                delete_document_object(item.object_key, s3_version_id)
            except StorageUnavailableError as cleanup_error:
                cleanup_message = f"; S3 cleanup failed: {cleanup_error}"
            try:
                failed_version = session.get(DocumentVersion, item.version_id)
                if failed_version is not None:
                    failed_version.status = "FAILED"
                    session.commit()
            except SQLAlchemyError:
                session.rollback()
            raise SeedError(
                f"Database finalization failed for {item.object_key}; compensation attempted"
                f"{cleanup_message}."
            )
        return "uploaded", item.object_key
    except SQLAlchemyError as exc:
        session.rollback()
        raise SeedError(f"Database operation failed for {item.object_key}: {exc}") from exc
    finally:
        session.close()


def _verify_target(
    items: list[Item],
    records: dict[UUID, Document],
    client,
    workers: int,
) -> tuple[int, int, list[str]]:
    failures: list[str] = []
    checked_objects = 0
    valid_records = 0
    version_by_document: dict[UUID, DocumentVersion] = {}
    with SessionLocal() as session:
        versions = session.execute(
            select(DocumentVersion).where(
                DocumentVersion.document_id.in_([item.document_id for item in items])
            )
        ).scalars()
        version_by_document = {version.document_id: version for version in versions}

    for item in items:
        document = records.get(item.document_id)
        version = version_by_document.get(item.document_id)
        if document is None or version is None:
            failures.append(f"missing database record: {item.document_id}")
            continue
        try:
            _validate_existing_document(document, item)
            _check_existing_version(version, item)
            if (
                version.status != "AVAILABLE"
                or document.current_version_id != version.id
                or version.uploaded_by_user_id != document.owner_user_id
            ):
                failures.append(f"not available/current: {item.document_id}")
                continue
            valid_records += 1
        except SeedError as exc:
            failures.append(str(exc))

    def verify_item(item: Item) -> tuple[Item, str | None]:
        try:
            head = _head_if_present(client, item)
            if head is None:
                return item, f"missing S3 object: {item.object_key}"
            _verify_object(client, item, head)
            return item, None
        except (SeedError, ClientError) as exc:
            return item, str(exc)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(verify_item, item) for item in items]
        for future in as_completed(futures):
            _, error = future.result()
            checked_objects += 1
            if error:
                failures.append(error)
    return valid_records, checked_objects, failures


def _run(args: argparse.Namespace) -> int:
    root = args.documents_root.resolve()
    sources = _load_sources(root)
    items = _items(sources, args.target_count)
    source_hashes = {source.checksum for source in sources}

    for source in sources:
        scan_document_bytes(source.content)

    client = get_s3_client()
    with SessionLocal() as session:
        target_records = _target_documents(session)
        target_versions = _target_versions(session, items)
        owner = _select_owner(session, args.owner_email, target_records)
        owner_id = owner.id
        existing_source_records = session.execute(
            select(DocumentVersion.checksum_sha256).where(
                DocumentVersion.checksum_sha256.in_(source_hashes)
            )
        ).scalars().all()
        source_record_count = len(existing_source_records)

    if args.verify_only:
        valid_records, checked_objects, failures = _verify_target(
            items, target_records, client, args.workers
        )
        print(
            json.dumps(
                {
                    "dataset_id": DATASET_ID,
                    "target_count": args.target_count,
                    "database_records_available": valid_records,
                    "distinct_document_ids": len(
                        {item.document_id for item in items}
                    ),
                    "distinct_s3_keys": len({item.object_key for item in items}),
                    "s3_objects_checked": checked_objects,
                    "failures": failures,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0 if valid_records == args.target_count and not failures else 1

    matching_keys: set[str] = set()
    expected_keys = {item.object_key for item in items}
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix="documents/"):
        matching_keys.update(
            obj["Key"]
            for obj in page.get("Contents", [])
            if obj["Key"] in expected_keys
        )
    matching_source_objects = _source_hashes_in_s3(client, sources)

    already_valid = 0
    for item in items:
        document = target_records.get(item.document_id)
        version = target_versions.get(item.version_id)
        if document is None and version is not None:
            raise SeedError(
                f"Version {item.version_id} exists without its seeded document."
            )
        if document is not None:
            _validate_existing_document(document, item)
            if (
                document.owner_user_id != owner_id
                or document.created_by_user_id != owner_id
            ):
                raise SeedError(f"Ownership mismatch for seeded document {item.document_id}.")
            if version is None:
                raise SeedError(
                    f"Seeded document {item.document_id} exists without its expected version."
                )
            _check_existing_version(version, item)
            if version.uploaded_by_user_id != owner_id:
                raise SeedError(f"Uploader mismatch for seeded version {item.version_id}.")
        if item.object_key in matching_keys:
            head = client.head_object(
                Bucket=S3_BUCKET,
                Key=item.object_key,
                ChecksumMode="ENABLED",
            )
            _verify_object(client, item, head)
            if (
                document is not None
                and version is not None
                and version.status == "AVAILABLE"
                and document.current_version_id == version.id
            ):
                already_valid += 1

    estimated_bytes = sum(len(item.source.content) for item in items)
    missing_object_count = max(0, args.target_count - len(matching_keys))
    missing_record_count = max(0, args.target_count - len(target_records))
    new_bytes = sum(
        len(item.source.content)
        for item in items
        if item.object_key not in matching_keys
    )
    print(
        json.dumps(
            {
                "source_files": len(sources),
                "distinct_source_contents": len(source_hashes),
                "source_bytes": sum(len(source.content) for source in sources),
                "existing_s3_objects_matching_source_checksums": matching_source_objects,
                "existing_database_versions_matching_source_checksums": source_record_count,
                "existing_dataset_database_records": len(target_records),
                "existing_dataset_s3_objects": len(matching_keys),
                "already_complete_records_and_objects": already_valid,
                "planned_new_s3_objects": missing_object_count,
                "planned_new_database_records": missing_record_count,
                "planned_upload_bytes": new_bytes,
                "target_storage_bytes": estimated_bytes,
                "target_storage_mib": round(estimated_bytes / 1024 / 1024, 2),
                "bucket": S3_BUCKET,
                "owner_user_id": str(owner_id),
                "scanner_verdict": "CLEAN for every distinct source file",
                "dry_run": args.dry_run,
            },
            indent=2,
            sort_keys=True,
        )
    )
    if args.dry_run:
        return 0

    lock_session = SessionLocal()
    try:
        lock_session.execute(
            text("SELECT pg_advisory_lock(hashtext(:dataset_id))"),
            {"dataset_id": DATASET_ID},
        )
        lock_session.commit()
        completed = 0
        reconciled = 0
        skipped = 0
        failures: list[str] = []
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {executor.submit(_seed_one, item, owner_id): item for item in items}
            for future in as_completed(futures):
                item = futures[future]
                try:
                    outcome, _ = future.result()
                    if outcome == "uploaded":
                        completed += 1
                    elif outcome == "skipped":
                        skipped += 1
                    else:
                        reconciled += 1
                except (
                    SeedError,
                    StorageUnavailableError,
                    ClientError,
                    SQLAlchemyError,
                ) as exc:
                    failures.append(f"{item.document_id}: {exc}")
                processed = completed + reconciled + skipped + len(failures)
                if processed % 100 == 0 or processed == len(items):
                    print(
                        f"Progress {processed}/{len(items)}: uploaded={completed}, "
                        f"reconciled={reconciled}, skipped={skipped}, "
                        f"failed={len(failures)}",
                        flush=True,
                    )
        with SessionLocal() as session:
            final_records = _target_documents(session)
        valid_records, checked_objects, verification_failures = _verify_target(
            items, final_records, client, args.workers
        )
        failures.extend(verification_failures)
        source_files_unchanged = all(
            hashlib.sha256(source.path.read_bytes()).hexdigest() == source.checksum
            for source in sources
        )
        if not source_files_unchanged:
            failures.append("One or more source files changed during the run.")
        print(
            json.dumps(
                {
                    "uploaded_this_run": completed,
                    "reconciled_this_run": reconciled,
                    "skipped_this_run": skipped,
                    "database_records_available": valid_records,
                    "distinct_document_ids": len(
                        {item.document_id for item in items}
                    ),
                    "distinct_s3_keys": len({item.object_key for item in items}),
                    "s3_objects_checked": checked_objects,
                    "failures": failures,
                    "source_files_unchanged": source_files_unchanged,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0 if valid_records == args.target_count and not failures else 1
    finally:
        try:
            lock_session.execute(
                text("SELECT pg_advisory_unlock(hashtext(:dataset_id))"),
                {"dataset_id": DATASET_ID},
            )
            lock_session.commit()
        except SQLAlchemyError:
            lock_session.rollback()
        lock_session.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed a repeatable, private S3-backed SureDocs document dataset."
    )
    parser.add_argument(
        "--documents-root",
        type=Path,
        default=PROJECT_ROOT / "documents",
        help="Directory containing source documents.",
    )
    parser.add_argument(
        "--target-count",
        type=int,
        default=DEFAULT_TARGET,
        help="Total seeded documents, including each source's first copy.",
    )
    parser.add_argument(
        "--owner-email",
        help="Existing active account to own the dataset; defaults to oldest active admin.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help=f"Concurrent bounded S3/database workers (1-{MAX_WORKERS}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate sources and report the plan without changing S3 or database records.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify every expected seeded database record and S3 object.",
    )
    args = parser.parse_args()
    if args.target_count < 1:
        parser.error("--target-count must be at least 1.")
    if not 1 <= args.workers <= MAX_WORKERS:
        parser.error(f"--workers must be between 1 and {MAX_WORKERS}.")
    if args.dry_run and args.verify_only:
        parser.error("--dry-run and --verify-only cannot be combined.")
    try:
        return _run(args)
    except (SeedError, StorageUnavailableError, ClientError, SQLAlchemyError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
