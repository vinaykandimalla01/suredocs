"""Authenticated administrator recovery path for pending ClamAV scans."""

from __future__ import annotations

import base64
import hashlib
import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import MAX_DOCUMENT_SIZE_BYTES, S3_BUCKET
from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.documents import Document, DocumentVersion
from app.models.user import User
from app.schemas.document_scans import (
    PendingDocumentScanBatchResponse,
    PendingDocumentScanResult,
)
from app.services.antivirus import MalwareDetectedError, ScannerUnavailableError, scan_document_bytes
from app.services.document_access import record_audit, utc_now
from app.services.s3_storage import StorageUnavailableError, get_document as get_s3_document

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/document-scans", tags=["admin-document-scans"])


class ScanSourceIntegrityError(RuntimeError):
    """The stored object does not match the pending version metadata."""


def _read_verified_version(version: DocumentVersion) -> bytes:
    if version.storage_bucket != S3_BUCKET:
        raise ScanSourceIntegrityError("The stored version references an unexpected bucket.")

    stored = get_s3_document(version.storage_key, version.s3_version_id)
    body = stored["Body"]
    try:
        content = body.read(MAX_DOCUMENT_SIZE_BYTES + 1)
    finally:
        body.close()

    if len(content) > MAX_DOCUMENT_SIZE_BYTES or len(content) != version.size_bytes:
        raise ScanSourceIntegrityError("The stored version size does not match its metadata.")
    if hashlib.sha256(content).hexdigest().casefold() != version.checksum_sha256.casefold():
        raise ScanSourceIntegrityError("The stored version checksum does not match its metadata.")

    stored_checksum = stored.get("Metadata", {}).get("sha256")
    expected_s3_checksum = base64.b64encode(
        bytes.fromhex(version.checksum_sha256),
    ).decode("ascii")
    if stored_checksum and stored_checksum != expected_s3_checksum:
        raise ScanSourceIntegrityError("The S3 checksum metadata does not match the version.")
    return content


def _record_scan_event(
    db: Session,
    request: Request,
    *,
    actor: User,
    document: Document,
    version: DocumentVersion,
    result: str,
    details: dict[str, str],
) -> None:
    record_audit(
        db,
        request,
        actor_user_id=actor.id,
        action_type="DOCUMENT_SCAN_COMPLETED",
        result=result,
        document=document,
        details={
            "version_id": str(version.id),
            "version_number": str(version.version_number),
            **details,
        },
    )


@router.post("/pending", response_model=PendingDocumentScanBatchResponse)
async def scan_pending_document_versions(
    request: Request,
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PendingDocumentScanBatchResponse:
    version_ids = db.scalars(
        select(DocumentVersion.id)
        .where(DocumentVersion.status == "PENDING_SCAN")
        .order_by(DocumentVersion.uploaded_at, DocumentVersion.id)
        .limit(limit)
    ).all()

    results: list[PendingDocumentScanResult] = []
    for version_id in version_ids:
        version = db.execute(
            select(DocumentVersion)
            .where(DocumentVersion.id == version_id)
            .with_for_update(skip_locked=True)
        ).scalar_one_or_none()
        if version is None or version.status != "PENDING_SCAN":
            continue

        document = db.execute(
            select(Document)
            .where(Document.id == version.document_id)
            .with_for_update()
        ).scalar_one_or_none()
        if document is None or document.status != "ACTIVE" or document.deleted_at is not None:
            results.append(PendingDocumentScanResult(
                document_id=version.document_id,
                version_id=version.id,
                status="PENDING_SCAN",
                reason="document_inactive",
            ))
            db.rollback()
            continue

        try:
            content = await run_in_threadpool(_read_verified_version, version)
            await run_in_threadpool(scan_document_bytes, content)
        except MalwareDetectedError:
            version.status = "QUARANTINED"
            version.scan_completed_at = utc_now()
            _record_scan_event(
                db,
                request,
                actor=current_user,
                document=document,
                version=version,
                result="FAILED",
                details={"verdict": "infected", "reason": "malware_detected"},
            )
            db.commit()
            results.append(PendingDocumentScanResult(
                document_id=document.id,
                version_id=version.id,
                status=version.status,
                reason="malware_detected",
            ))
            continue
        except ScannerUnavailableError:
            _record_scan_event(
                db,
                request,
                actor=current_user,
                document=document,
                version=version,
                result="FAILED",
                details={"verdict": "unavailable", "reason": "scanner_unavailable"},
            )
            db.commit()
            results.append(PendingDocumentScanResult(
                document_id=document.id,
                version_id=version.id,
                status=version.status,
                reason="scanner_unavailable",
            ))
            continue
        except (OSError, ScanSourceIntegrityError, StorageUnavailableError):
            _record_scan_event(
                db,
                request,
                actor=current_user,
                document=document,
                version=version,
                result="FAILED",
                details={"verdict": "unavailable", "reason": "source_integrity_or_storage_error"},
            )
            db.commit()
            results.append(PendingDocumentScanResult(
                document_id=document.id,
                version_id=version.id,
                status=version.status,
                reason="source_integrity_or_storage_error",
            ))
            continue

        version.status = "AVAILABLE"
        version.scan_completed_at = utc_now()
        current_version = (
            db.get(DocumentVersion, document.current_version_id)
            if document.current_version_id is not None
            else None
        )
        if current_version is None or current_version.version_number < version.version_number:
            document.current_version_id = version.id
            document.updated_at = utc_now()
        _record_scan_event(
            db,
            request,
            actor=current_user,
            document=document,
            version=version,
            result="SUCCESS",
            details={"verdict": "clean"},
        )
        db.commit()
        results.append(PendingDocumentScanResult(
            document_id=document.id,
            version_id=version.id,
            status=version.status,
        ))

    available = sum(result.status == "AVAILABLE" for result in results)
    quarantined = sum(result.status == "QUARANTINED" for result in results)
    pending = sum(result.status == "PENDING_SCAN" for result in results)
    return PendingDocumentScanBatchResponse(
        processed=len(results),
        available=available,
        quarantined=quarantined,
        still_pending=pending,
        results=results,
    )
