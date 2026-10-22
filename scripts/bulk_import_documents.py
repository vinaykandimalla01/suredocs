#!/usr/bin/env python3
"""Temporary bootstrap utility to import the local document library into SureDocs.

This script is intentionally separate from the normal upload flow and is safe to
rerun. It looks for supported files under the project-level `documents/`
folder, uploads each file to the configured private S3 bucket, and persists the
matching metadata in the existing database schema.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mimetypes
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Iterable
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import S3_BUCKET
from app.db.session import SessionLocal
from app.models.documents import Document, DocumentVersion
from app.models.user import User, UserRole
from app.services.s3_storage import StorageUnavailableError, delete_document_object, put_document

ALLOWED_SUFFIXES = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".csv",
    ".md",
}

CONTENT_TYPE_BY_SUFFIX = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".csv": "text/csv",
    ".md": "text/markdown",
}


@dataclass(frozen=True)
class ManifestEntry:
    filename: str
    title: str
    category: str
    description: str | None = None
    tags: tuple[str, ...] = ()
    classification: str = "CONFIDENTIAL"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_manifest(manifest_path: Path) -> dict[str, ManifestEntry]:
    if not manifest_path.exists():
        return {}
    with manifest_path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    manifest: dict[str, ManifestEntry] = {}
    for row in rows:
        filename = (row.get("filename") or "").strip()
        if not filename:
            continue
        tags_value = (row.get("tags") or "").strip()
        tags = tuple(part.strip() for part in tags_value.split(",") if part.strip())
        description = (row.get("description") or row.get("title") or "").strip() or None
        classification = (row.get("classification") or "CONFIDENTIAL").strip().upper()
        manifest[filename] = ManifestEntry(
            filename=filename,
            title=(row.get("title") or filename).strip(),
            category=(row.get("category") or "General").strip(),
            description=description,
            tags=tags,
            classification=classification if classification in {"INTERNAL", "CONFIDENTIAL", "RESTRICTED"} else "CONFIDENTIAL",
        )
    return manifest


def _discover_documents(documents_root: Path) -> list[Path]:
    files: list[Path] = []
    if not documents_root.exists():
        return files
    for path in sorted(documents_root.rglob("*")):
        if (
            path.is_file()
            and path.name.lower() != "manifest.csv"
            and path.suffix.lower() in ALLOWED_SUFFIXES
        ):
            files.append(path)
    return files


def _safe_title(filename: str, manifest: ManifestEntry | None) -> str:
    if manifest and manifest.title:
        return manifest.title
    stem = Path(filename).stem.replace("_", " ").replace("-", " ")
    return " ".join(part for part in stem.split() if part).strip() or "Imported document"


def _guess_category(filename: str, manifest: ManifestEntry | None) -> str:
    if manifest and manifest.category:
        return manifest.category
    value = Path(filename).stem
    lowered = value.lower()
    for keyword, category in [
        ("security", "Security"),
        ("legal", "Legal"),
        ("policy", "Operations"),
        ("finance", "Finance"),
        ("hr", "Human Resources"),
        ("risk", "Risk Management"),
        ("compliance", "Compliance"),
        ("privacy", "Compliance"),
        ("vendor", "Legal"),
        ("contract", "Legal"),
    ]:
        if keyword in lowered:
            return category
    return "General"


def _guess_classification(filename: str, manifest: ManifestEntry | None) -> str:
    if manifest and manifest.classification:
        return manifest.classification
    lowered = filename.lower()
    if any(token in lowered for token in ["security", "risk", "privacy", "legal", "contract", "nda", "policy", "finance"]):
        return "CONFIDENTIAL"
    return "INTERNAL"


def _server_content_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return CONTENT_TYPE_BY_SUFFIX.get(suffix, mimetypes.guess_type(filename)[0] or "application/octet-stream")


def _select_user(db_session, owner_email: str | None) -> User:
    email = (owner_email or os.getenv("SUREDOCS_IMPORT_OWNER_EMAIL") or "").strip().lower()
    if email:
        user = db_session.execute(
            select(User).where(func.lower(User.email) == email)
        ).scalar_one_or_none()
        if user is None:
            raise RuntimeError(f"No user exists for email {email!r}. Choose an active account or create one first.")
        return user

    admin = db_session.execute(
        select(User)
        .where(User.role == UserRole.ADMIN, User.account_status == "ACTIVE")
        .order_by(User.created_at.asc())
    ).first()
    if admin is not None:
        return admin[0]

    employee = db_session.execute(
        select(User)
        .where(User.account_status == "ACTIVE")
        .order_by(User.created_at.asc())
    ).first()
    if employee is not None:
        return employee[0]

    raise RuntimeError(
        "No active user exists for importing documents. Create an administrator with `python -m app.cli create-admin` or pass --owner-email."
    )


def _checksum_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _ensure_no_duplicate(db_session, checksum: str, owner_user_id: UUID, original_name: str) -> DocumentVersion | None:
    return db_session.execute(
        select(DocumentVersion).where(
            DocumentVersion.checksum_sha256 == checksum,
            DocumentVersion.uploaded_by_user_id == owner_user_id,
        )
    ).scalar_one_or_none() or db_session.execute(
        select(DocumentVersion).where(
            DocumentVersion.original_filename == original_name,
            DocumentVersion.uploaded_by_user_id == owner_user_id,
        )
    ).scalar_one_or_none()


def _build_document_metadata(path: Path, manifest: ManifestEntry | None, owner_user: User) -> dict[str, object]:
    title = _safe_title(path.name, manifest)
    category = _guess_category(path.name, manifest)
    classification = _guess_classification(path.name, manifest)
    tags = list(manifest.tags if manifest else [])
    if category and category not in tags:
        tags.insert(0, category)
    description = (
        manifest.description
        if manifest and manifest.description
        else f"Imported {category.lower()} document from the local SureDocs repository."
    )
    source_name = path.name
    return {
        "title": title,
        "description": description,
        "category": category,
        "classification": classification,
        "owner_user_id": str(owner_user.id),
        "department": owner_user.department,
        "status": "ACTIVE",
        "custom_metadata": {
            "source_file": source_name,
            "source_folder": str(path.parent.relative_to(PROJECT_ROOT)),
            "import_origin": "bulk_upload_bootstrap",
            "manifest": manifest.__dict__ if manifest else {},
            "tags": tags,
        },
    }


def _read_manifest_entry(path: Path, manifest_map: dict[str, ManifestEntry]) -> ManifestEntry | None:
    return manifest_map.get(path.name) or manifest_map.get(path.name.replace(" ", "_"))


def _import_one_document(db_session, document_path: Path, owner_user: User, manifest_map: dict[str, ManifestEntry], *, dry_run: bool) -> tuple[str, str]:
    manifest = _read_manifest_entry(document_path, manifest_map)
    metadata = _build_document_metadata(document_path, manifest, owner_user)
    file_bytes = document_path.read_bytes()
    checksum = hashlib.sha256(file_bytes).hexdigest()
    existing = _ensure_no_duplicate(db_session, checksum, owner_user.id, document_path.name)
    if existing is not None:
        return "skipped", f"already imported: {document_path.name} ({existing.id})"

    content_type = _server_content_type(document_path.name)
    document_id = uuid4()
    version_id = uuid4()
    object_key = f"documents/{document_id}/versions/{version_id}/content"
    now = _now()

    document = Document(
        id=document_id,
        owner_user_id=owner_user.id,
        created_by_user_id=owner_user.id,
        title=metadata["title"],
        description=metadata["description"],
        category=metadata["category"],
        classification=metadata["classification"],
        department=metadata["department"],
        status="ACTIVE",
        custom_metadata=metadata["custom_metadata"],
        created_at=now,
        updated_at=now,
    )
    version = DocumentVersion(
        id=version_id,
        document_id=document_id,
        version_number=1,
        storage_bucket=S3_BUCKET,
        storage_key=object_key,
        original_filename=document_path.name,
        file_extension=document_path.suffix.lower().lstrip("."),
        content_type=content_type,
        size_bytes=len(file_bytes),
        checksum_sha256=checksum,
        status="PENDING_UPLOAD",
        uploaded_by_user_id=owner_user.id,
        uploaded_at=now,
        created_at=now,
    )

    if dry_run:
        return "skipped", f"dry-run: {document_path.name} would be uploaded to {S3_BUCKET}/{object_key}"

    try:
        db_session.add(document)
        db_session.add(version)
        db_session.commit()
    except SQLAlchemyError as exc:
        db_session.rollback()
        return "failed", f"database metadata creation failed for {document_path.name}: {exc}"

    try:
        s3_version_id = put_document(
            object_key,
            BytesIO(file_bytes),
            content_type=content_type,
            checksum_sha256=checksum,
        )
    except StorageUnavailableError as exc:
        try:
            version.status = "FAILED"
            db_session.add(version)
            db_session.commit()
        except SQLAlchemyError:
            db_session.rollback()
        return "failed", f"S3 upload failed for {document_path.name}: {exc}"

    try:
        version.status = "AVAILABLE"
        version.s3_version_id = s3_version_id
        document.current_version_id = version.id
        document.updated_at = now
        db_session.add(version)
        db_session.add(document)
        db_session.commit()
        return "uploaded", f"uploaded: {document_path.name} -> {object_key}"
    except SQLAlchemyError as exc:
        db_session.rollback()
        try:
            if s3_version_id is not None:
                delete_document_object(object_key, s3_version_id)
        except StorageUnavailableError:
            pass
        return "failed", (
            f"database finalization failed after S3 upload for {document_path.name}; "
            f"S3 object was cleaned up and the record should be retried: {exc}"
        )


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Temporary bulk import of the local documents library into SureDocs.")
    parser.add_argument("--documents-root", type=Path, default=PROJECT_ROOT / "documents", help="Folder containing files to import.")
    parser.add_argument("--manifest", type=Path, default=PROJECT_ROOT / "documents" / "manifest.csv", help="CSV manifest used to enrich metadata.")
    parser.add_argument("--owner-email", default=None, help="Email of an existing active user that should own imported documents.")
    parser.add_argument("--dry-run", action="store_true", help="List files that would be imported without uploading or committing records.")
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not args.documents_root.exists():
        print(f"ERROR: documents folder not found: {args.documents_root}", file=sys.stderr)
        return 2

    db_session = SessionLocal()
    try:
        owner_user = _select_user(db_session, args.owner_email)
        manifest = _load_manifest(args.manifest)
        files = _discover_documents(args.documents_root)
        if not files:
            print(f"No supported files found under {args.documents_root}.")
            return 0

        counts = {"discovered": len(files), "uploaded": 0, "failed": 0, "skipped": 0}
        for path in files:
            status, message = _import_one_document(
                db_session,
                path,
                owner_user,
                manifest,
                dry_run=args.dry_run,
            )
            print(message)
            counts[status if status in {"uploaded", "failed", "skipped"} else "skipped"] += 1

        print("\nSummary:")
        print(json.dumps(counts, sort_keys=True, indent=2))
        return 0 if counts["failed"] == 0 else 1
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        db_session.close()


if __name__ == "__main__":
    raise SystemExit(main())
