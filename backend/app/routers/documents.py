"""Authenticated document upload, access, version, and sharing endpoints."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import tomllib
import uuid
import zipfile
import xml.etree.ElementTree as ElementTree
from datetime import timedelta
from email import policy as email_policy
from email.parser import BytesParser
from io import BytesIO
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import cast, exists, func, select, String
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, aliased, joinedload
from starlette.concurrency import run_in_threadpool

from app.core.config import MAX_DOCUMENT_SIZE_BYTES, S3_BUCKET
from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_db
from app.models.documents import (
    Document,
    DocumentAuditLog,
    DocumentPermission,
    DocumentVersion,
)
from app.models.user import AccountStatus, User, UserRole
from app.schemas.documents import (
    DocumentAuditListResponse,
    DocumentAuditResponse,
    DocumentCategoryListResponse,
    DocumentCategoryCount,
    DocumentListResponse,
    DocumentMetadataUpdate,
    DocumentPermissionListResponse,
    DocumentPermissionResponse,
    DocumentResponse,
    DocumentRegistrySummaryResponse,
    DocumentSummaryResponse,
    DocumentVersionListResponse,
    DocumentVersionResponse,
    PermissionGrantRequest,
    UserOption,
)
from app.services.document_access import (
    DocumentAction,
    get_document,
    permission_for,
    record_audit,
    require_access,
    require_edit,
    require_owner,
    utc_now,
)
from app.services.notifications import add_notification
from app.services.s3_storage import (
    StorageObjectNotFoundError,
    StorageUnavailableError,
    delete_document_object,
    get_document as get_s3_document,
    put_document,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

_FILE_TYPES = {
    ".pdf": ("application/pdf", "pdf"),
    ".doc": ("application/msword", "doc"),
    ".docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
    ".xls": ("application/vnd.ms-excel", "xls"),
    ".xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    ),
    ".ppt": ("application/vnd.ms-powerpoint", "ppt"),
    ".pptx": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
    ),
    ".png": ("image/png", "png"),
    ".jpg": ("image/jpeg", "jpg"),
    ".jpeg": ("image/jpeg", "jpeg"),
    ".gif": ("image/gif", "gif"),
    ".webp": ("image/webp", "webp"),
    ".json": ("application/json", "json"),
    ".txt": ("text/plain", "txt"),
    ".log": ("text/plain", "log"),
    ".csv": ("text/csv", "csv"),
    ".adoc": ("text/plain", "adoc"),
    ".drawio": ("application/xml", "drawio"),
    ".eml": ("message/rfc822", "eml"),
    ".epub": ("application/epub+zip", "epub"),
    ".html": ("text/html", "html"),
    ".ics": ("text/calendar", "ics"),
    ".ini": ("text/plain", "ini"),
    ".jsonl": ("application/x-ndjson", "jsonl"),
    ".md": ("text/markdown", "md"),
    ".mmd": ("text/plain", "mmd"),
    ".ndjson": ("application/x-ndjson", "ndjson"),
    ".org": ("text/plain", "org"),
    ".properties": ("text/plain", "properties"),
    ".proto": ("text/plain", "proto"),
    ".rst": ("text/plain", "rst"),
    ".rtf": ("application/rtf", "rtf"),
    ".sql": ("application/sql", "sql"),
    ".svg": ("image/svg+xml", "svg"),
    ".tex": ("application/x-tex", "tex"),
    ".toml": ("application/toml", "toml"),
    ".tsv": ("text/tab-separated-values", "tsv"),
    ".xml": ("application/xml", "xml"),
    ".xsd": ("application/xml", "xsd"),
    ".yaml": ("application/yaml", "yaml"),
}

_CLASSIFICATIONS = {"INTERNAL", "CONFIDENTIAL", "RESTRICTED"}
_OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_TEXT_FORMATS = {
    ".adoc", ".html", ".ics", ".ini", ".md", ".mmd", ".org",
    ".properties", ".proto", ".rst", ".sql", ".tex", ".toml", ".tsv",
    ".yaml",
}
_JSON_LINES_FORMATS = {".jsonl", ".ndjson"}
_XML_FORMATS = {".drawio", ".svg", ".xml", ".xsd"}
_CONTENT_TYPE_ALIASES = {
    ".adoc": {"text/asciidoc"},
    ".drawio": {"application/vnd.jgraph.mxfile", "text/xml"},
    ".eml": {"text/plain"},
    ".epub": {"application/zip"},
    ".ics": {"text/plain"},
    ".jsonl": {"application/json", "application/ndjson", "text/plain"},
    ".md": {"text/plain"},
    ".ndjson": {"application/json", "application/ndjson", "text/plain"},
    ".rtf": {"text/rtf"},
    ".svg": {"application/xml", "text/xml"},
    ".tex": {"text/plain"},
    ".toml": {"application/x-toml", "text/plain"},
    ".tsv": {"text/plain"},
    ".xml": {"text/xml"},
    ".xsd": {"text/xml"},
    ".yaml": {"application/x-yaml", "text/yaml", "text/plain"},
}


def _decode_utf8(content: bytes) -> str | None:
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None


def _valid_xml(content: bytes, *, expected_root: str | None = None) -> bool:
    if re.search(br"<!DOCTYPE|<!ENTITY", content, flags=re.IGNORECASE):
        return False
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError:
        return False
    local_name = root.tag.rsplit("}", 1)[-1].lower() if isinstance(root.tag, str) else ""
    return expected_root is None or local_name == expected_root


def _valid_epub(content: bytes) -> bool:
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            names = archive.namelist()
            if not names or names[0] != "mimetype" or "META-INF/container.xml" not in names:
                return False
            mimetype = archive.getinfo("mimetype")
            container = archive.getinfo("META-INF/container.xml")
            if mimetype.compress_type != zipfile.ZIP_STORED or mimetype.file_size > 64:
                return False
            if container.file_size > 2 * 1024 * 1024:
                return False
            return (
                archive.read("mimetype") == b"application/epub+zip"
                and _valid_xml(archive.read("META-INF/container.xml"))
            )
    except (OSError, ValueError, zipfile.BadZipFile, KeyError):
        return False


def _safe_filename(filename: str | None) -> str:
    value = (filename or "").replace("\\", "/")
    name = PurePosixPath(value).name
    name = "".join(char for char in name if char.isprintable() and char not in "\r\n")
    name = name.strip()
    if not name or name in {".", ".."} or len(name) > 255:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide a valid document filename of at most 255 characters.",
        )
    return name


def _validate_content(filename: str, content_type: str | None, content: bytes) -> tuple[str, str]:
    suffix = PurePosixPath(filename).suffix.lower()
    expected = _FILE_TYPES.get(suffix)
    if expected is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="This file extension is not supported.",
        )
    expected_type, extension = expected
    declared = (content_type or "").split(";", 1)[0].strip().lower()
    accepted_types = {
        expected_type,
        "application/octet-stream",
        *_CONTENT_TYPE_ALIASES.get(suffix, set()),
    }
    if declared and declared not in accepted_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The file content type does not match its extension.",
        )
    valid_signature = {
        ".pdf": content.startswith(b"%PDF-"),
        ".png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": content.startswith(b"\xff\xd8\xff"),
        ".jpeg": content.startswith(b"\xff\xd8\xff"),
        ".gif": len(content) >= 13 and content[:6] in {b"GIF87a", b"GIF89a"},
        ".webp": len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP",
        ".doc": content.startswith(_OLE_SIGNATURE),
        ".xls": content.startswith(_OLE_SIGNATURE),
        ".ppt": content.startswith(_OLE_SIGNATURE),
    }
    if suffix in {".json", ".txt", ".log", ".csv"} | _TEXT_FORMATS:
        decoded = _decode_utf8(content)
        matches_signature = decoded is not None
        if matches_signature and suffix == ".toml":
            try:
                tomllib.loads(decoded)
            except tomllib.TOMLDecodeError:
                matches_signature = False
        elif matches_signature and suffix == ".ics":
            normalized = decoded.upper()
            matches_signature = (
                "BEGIN:VCALENDAR" in normalized
                and "END:VCALENDAR" in normalized
            )
    elif suffix in _JSON_LINES_FORMATS:
        decoded = _decode_utf8(content)
        try:
            if decoded is None:
                matches_signature = False
            else:
                rows = [line for line in decoded.splitlines() if line.strip()]
                matches_signature = bool(rows)
                for line in rows:
                    json.loads(line)
        except (json.JSONDecodeError, TypeError):
            matches_signature = False
    elif suffix == ".eml":
        try:
            message = BytesParser(policy=email_policy.default).parsebytes(content)
            matches_signature = bool(message.keys())
        except (ValueError, UnicodeError):
            matches_signature = False
    elif suffix == ".rtf":
        matches_signature = content.lstrip().startswith(b"{\\rtf")
    elif suffix == ".epub":
        matches_signature = _valid_epub(content)
    elif suffix in _XML_FORMATS:
        expected_root = "svg" if suffix == ".svg" else None
        matches_signature = _valid_xml(content, expected_root=expected_root)
    elif suffix in {".docx", ".xlsx", ".pptx"}:
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                members = set(archive.namelist())
                office_root = {
                    ".docx": "word/document.xml",
                    ".xlsx": "xl/workbook.xml",
                    ".pptx": "ppt/presentation.xml",
                }[suffix]
                matches_signature = office_root in members
        except (zipfile.BadZipFile, OSError):
            matches_signature = False
    else:
        matches_signature = valid_signature.get(suffix, False)
    if not content or not matches_signature:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The file contents do not match a supported file format.",
        )
    return expected_type, extension


async def _read_upload(upload: UploadFile) -> tuple[str, str, bytes]:
    filename = _safe_filename(upload.filename)
    content = await upload.read(MAX_DOCUMENT_SIZE_BYTES + 1)
    if len(content) > MAX_DOCUMENT_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Documents must be 50 MB or smaller.",
        )
    content_type, _ = _validate_content(
        filename,
        upload.content_type,
        content,
    )
    return filename, content_type, content


def _document_response(
    db: Session,
    document: Document,
    user: User,
    *,
    registry: bool = False,
    permission_count: int | None = None,
    grant: DocumentPermission | None = None,
) -> DocumentResponse:
    version = document.current_version
    owner = document.owner
    if not registry:
        grant = permission_for(db, document.id, user.id)
    is_owner = document.owner_user_id == user.id
    has_view = is_owner or bool(grant and grant.is_effective and grant.can_view)
    has_download = is_owner or bool(
        grant and grant.is_effective and grant.can_download
    )
    has_edit = is_owner or bool(grant and grant.is_effective and grant.can_edit)
    permission_grantor = (
        db.get(User, grant.granted_by_user_id)
        if grant is not None and not is_owner
        else None
    )
    return DocumentResponse(
        id=document.id,
        owner_user_id=document.owner_user_id,
        owner_name=owner.full_name,
        owner_email=owner.email,
        owner_role=owner.role.value,
        owner_department=owner.department,
        permission_granted_at=grant.granted_at if grant and not is_owner else None,
        permission_expires_at=grant.expires_at if grant and not is_owner else None,
        permission_granted_by_name=(
            permission_grantor.full_name if permission_grantor else None
        ),
        permission_granted_by_email=(
            permission_grantor.email if permission_grantor else None
        ),
        created_by_user_id=document.created_by_user_id,
        title=document.title,
        original_filename=version.original_filename if version else None,
        description=document.description,
        category=document.category,
        classification=document.classification,
        department=document.department,
        status=document.status,
        custom_metadata=document.custom_metadata,
        current_version_id=document.current_version_id,
        current_version_number=version.version_number if version else None,
        current_version_status=version.status if version else None,
        content_type=version.content_type if version else None,
        size_bytes=version.size_bytes if version else None,
        checksum_sha256=version.checksum_sha256 if version else None,
        created_at=document.created_at,
        updated_at=document.updated_at,
        deleted_at=document.deleted_at,
        can_view=has_view,
        can_download=has_download,
        can_edit=has_edit,
        is_owner=is_owner,
        permission_count=permission_count,
    )


def _list_response(
    db: Session,
    documents: list[Document],
    user: User,
    *,
    registry: bool = False,
) -> DocumentListResponse:
    permission_counts: dict[uuid.UUID, int] = {}
    user_grants: dict[uuid.UUID, DocumentPermission] = {}
    if registry and documents:
        document_ids = [document.id for document in documents]
        now = utc_now()
        count_rows = db.execute(
            select(
                DocumentPermission.document_id,
                func.count(func.distinct(DocumentPermission.user_id)),
            )
            .join(Document, Document.id == DocumentPermission.document_id)
            .where(
                DocumentPermission.document_id.in_(document_ids),
                DocumentPermission.can_view.is_(True),
                DocumentPermission.revoked_at.is_(None),
                (DocumentPermission.expires_at.is_(None))
                | (DocumentPermission.expires_at > now),
                Document.status == "ACTIVE",
                Document.current_version_id.is_not(None),
            )
            .group_by(DocumentPermission.document_id)
        )
        permission_counts = {document_id: count for document_id, count in count_rows}
        user_grants = {
            grant.document_id: grant
            for grant in db.scalars(
                select(DocumentPermission).where(
                    DocumentPermission.document_id.in_(document_ids),
                    DocumentPermission.user_id == user.id,
                )
            )
        }
    return DocumentListResponse(
        items=[
            _document_response(
                db,
                document,
                user,
                registry=registry,
                permission_count=permission_counts.get(document.id, 0),
                grant=user_grants.get(document.id),
            )
            for document in documents
        ],
        total=len(documents),
    )


def _permission_status(permission: DocumentPermission, document: Document, recipient: User) -> str:
    now = utc_now()
    if permission.revoked_at is not None:
        return "revoked"
    if permission.expires_at is not None and permission.expires_at <= now:
        return "expired"
    version = document.current_version
    if (
        document.status != "ACTIVE"
        or document.deleted_at is not None
        or version is None
        or version.status != "AVAILABLE"
        or recipient.account_status != AccountStatus.ACTIVE
    ):
        return "unavailable"
    if permission.expires_at is not None and permission.expires_at <= now + timedelta(days=30):
        return "expiring_soon"
    return "active"


def _owner_document(
    db: Session,
    request: Request,
    document_id: uuid.UUID,
    user: User,
    operation: str,
    forbidden_for_existing_document: bool = False,
) -> Document:
    return require_owner(
        db,
        request,
        get_document(db, document_id, for_update=True),
        user,
        operation,
        requested_id=document_id,
        forbidden_for_existing_document=forbidden_for_existing_document,
    )


def _editable_document(
    db: Session,
    request: Request,
    document_id: uuid.UUID,
    user: User,
    operation: str,
) -> Document:
    return require_edit(
        db,
        request,
        get_document(db, document_id, for_update=True),
        user,
        operation,
        requested_id=document_id,
    )


def _make_pending_version(
    db: Session,
    document: Document,
    user: User,
    filename: str,
    content_type: str,
    extension: str,
    content: bytes,
) -> tuple[DocumentVersion, str]:
    version = DocumentVersion(
        id=uuid.uuid4(),
        document_id=document.id,
        version_number=(max((item.version_number for item in document.versions), default=0) + 1),
        storage_bucket=S3_BUCKET,
        storage_key="",
        original_filename=filename,
        file_extension=extension,
        content_type=content_type,
        size_bytes=len(content),
        checksum_sha256=hashlib.sha256(content).hexdigest(),
        status="PENDING_UPLOAD",
        uploaded_by_user_id=user.id,
        uploaded_at=utc_now(),
    )
    version.storage_key = (
        f"documents/{document.id}/versions/{version.id}/content"
    )
    db.add(version)
    return version, version.checksum_sha256


async def _store_and_publish_version(
    db: Session,
    request: Request,
    document: Document,
    version: DocumentVersion,
    user: User,
    content: bytes,
    *,
    checksum: str | None = None,
    record_upload_success: bool = False,
) -> str:
    """Validate, store in S3, and publish a document version.

    Returns the final version status.
    """
    checksum_val = checksum or version.checksum_sha256
    storage_written = False
    s3_version_id: str | None = None
    previous_current_version_id = document.current_version_id
    version_id = version.id
    document_id = document.id
    storage_key = version.storage_key

    base64_sha256 = base64.b64encode(bytes.fromhex(checksum_val)).decode("ascii")
    try:
        s3_version_id = await run_in_threadpool(
            put_document,
            version.storage_key,
            BytesIO(content),
            content_type=version.content_type,
            checksum_sha256=base64_sha256,
        )
        storage_written = True
        version.s3_version_id = s3_version_id
        logger.info("Document stored in S3")
    except StorageUnavailableError as storage_exc:
        logger.error("Failed to store document: %s", storage_exc)
        version.status = "FAILED"
        record_audit(
            db,
            request,
            actor_user_id=user.id,
            action_type="UPLOAD_REJECTED",
            result="FAILED",
            document=document,
            details={
                "version_id": str(version.id),
                "reason": "storage_failure",
            },
        )
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="The document could not be stored. Please retry later.",
        ) from storage_exc

    version.status = "AVAILABLE"
    current_version = (
        db.get(DocumentVersion, document.current_version_id)
        if document.current_version_id is not None
        else None
    )
    if current_version is None or current_version.version_number < version.version_number:
        document.current_version_id = version.id
    if record_upload_success:
        record_audit(
            db,
            request,
            actor_user_id=user.id,
            action_type="DOCUMENT_UPLOADED",
            result="SUCCESS",
            document=document,
            details={
                "version_id": str(version.id),
                "version_number": str(version.version_number),
            },
        )

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Could not persist document version %s", version_id)
        if storage_written:
            try:
                await run_in_threadpool(
                    delete_document_object,
                    storage_key,
                    s3_version_id,
                )
            except Exception as cleanup_exc:
                logger.error(
                    "Upload compensation failed (%s)",
                    type(cleanup_exc).__name__,
                )
        failed_version = db.get(DocumentVersion, version_id)
        failed_document = db.get(Document, document_id)
        if failed_version is not None:
            failed_version.status = "FAILED"
            failed_version.s3_version_id = None
        if failed_document is not None:
            failed_document.current_version_id = previous_current_version_id
        if failed_document is not None:
            record_audit(
                db,
                request,
                actor_user_id=user.id,
                action_type="UPLOAD_REJECTED",
                result="FAILED",
                document=failed_document,
                details={
                    "version_id": str(version_id),
                    "reason": "finalize_failed",
                },
            )
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.error("Could not persist failed document finalization")
        raise HTTPException(
            status_code=503,
            detail="The upload could not be finalized. No document was made available.",
        )
    return version.status


def _response_stream(s3_object: dict[str, Any], on_error=None):
    body = s3_object["Body"]

    def chunks():
        try:
            yield from body.iter_chunks(chunk_size=64 * 1024)
        except Exception as exc:
            if on_error is not None:
                on_error(exc)
            raise
        finally:
            body.close()

    return chunks()


def _verify_object_size(
    s3_object: dict[str, Any],
    version: DocumentVersion,
) -> None:
    if s3_object.get("ContentLength") != version.size_bytes:
        s3_object["Body"].close()
        raise StorageUnavailableError(
            "The stored file does not match its verified metadata."
        )
    checksum = s3_object.get("Metadata", {}).get("sha256")
    expected_checksum = base64.b64encode(bytes.fromhex(version.checksum_sha256)).decode("ascii")
    if checksum is not None and checksum != expected_checksum:
        s3_object["Body"].close()
        raise StorageUnavailableError(
            "The stored file checksum does not match its verified metadata."
        )
    s3_checksum = s3_object.get("ChecksumSHA256")
    if s3_checksum is not None and s3_checksum != expected_checksum:
        s3_object["Body"].close()
        raise StorageUnavailableError(
            "The stored file checksum does not match its verified metadata."
        )


def _file_response(
    s3_object: dict[str, Any],
    version: DocumentVersion,
    *,
    inline: bool,
    on_stream_error=None,
) -> StreamingResponse:
    disposition = "inline" if inline else "attachment"
    ascii_filename = re.sub(r"[^A-Za-z0-9._-]", "_", version.original_filename)
    filename_star = quote(version.original_filename, safe="")
    headers = {
        "Content-Disposition": (
            f"{disposition}; filename=\"{ascii_filename}\"; "
            f"filename*=UTF-8''{filename_star}"
        ),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }
    if inline:
        if version.content_type in {"text/html", "image/svg+xml"}:
            headers["Content-Security-Policy"] = (
                "sandbox; default-src 'none'; style-src 'unsafe-inline'; "
                "object-src 'none'; base-uri 'none'; form-action 'none'; "
                "connect-src 'none'; frame-src 'none'; img-src 'none'; "
                "font-src 'none'; media-src 'none'"
            )
        else:
            headers["Content-Security-Policy"] = "sandbox"
    return StreamingResponse(
        _response_stream(s3_object, on_error=on_stream_error),
        media_type=version.content_type,
        headers=headers,
    )


def _load_accessible_version(
    db: Session,
    request: Request,
    document_id: uuid.UUID,
    version_id: uuid.UUID | None,
    user: User,
    action: DocumentAction,
) -> tuple[Document, DocumentVersion]:
    document = require_access(
        db,
        request,
        get_document(db, document_id),
        user,
        action,
        requested_id=document_id,
    )
    if version_id is None:
        version = document.current_version
    else:
        version = db.get(DocumentVersion, version_id)
        if version is not None and version.document_id != document.id:
            version = None
    if version is None or version.status != "AVAILABLE":
        record_audit(
            db,
            request,
            actor_user_id=user.id,
            action_type="ACCESS_DENIED",
            result="DENIED",
            document=document,
            details={
                "operation": action,
                "version_id": str(version_id) if version_id else None,
            },
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="An available document version was not found.",
        )
    return document, version


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    title: str | None = Form(default=None, max_length=255),
    description: str | None = Form(default=None, max_length=10000),
    category: str | None = Form(default=None, max_length=80),
    classification: str = Form(default="CONFIDENTIAL"),
    tags: list[str] | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    document_id = uuid.uuid4()
    try:
        filename, content_type, content = await _read_upload(file)
    except HTTPException as exc:
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="UPLOAD_REJECTED",
            result="DENIED",
            document_id=document_id,
            details={"http_status": exc.status_code},
        )
        db.commit()
        raise
    normalized_tags = []
    tag_error = len(tags or []) > 50
    for tag in tags or []:
        normalized = " ".join(tag.split())
        if len(normalized) > 80:
            tag_error = True
            break
        if normalized and normalized.casefold() not in {item.casefold() for item in normalized_tags}:
            normalized_tags.append(normalized)
    if tag_error:
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="UPLOAD_REJECTED",
            result="DENIED",
            document_id=document_id,
            details={"http_status": 422, "reason": "invalid_tags"},
        )
        db.commit()
        raise HTTPException(status_code=422, detail="Tags must be 80 characters or fewer, with at most 50 tags.")
    normalized_classification = classification.upper()
    if normalized_classification not in _CLASSIFICATIONS:
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="UPLOAD_REJECTED",
            result="DENIED",
            document_id=document_id,
            details={"http_status": 422},
        )
        db.commit()
        raise HTTPException(status_code=422, detail="Unsupported classification.")
    document = Document(
        id=document_id,
        owner_user_id=current_user.id,
        created_by_user_id=current_user.id,
        title=(title or PurePosixPath(filename).stem).strip(),
        description=description,
        category=category,
        classification=normalized_classification,
        department=current_user.department,
        status="ACTIVE",
        custom_metadata={"tags": normalized_tags},
    )
    if not document.title:
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="UPLOAD_REJECTED",
            result="DENIED",
            document_id=document_id,
            details={"http_status": 422},
        )
        db.commit()
        raise HTTPException(status_code=422, detail="Document title cannot be blank.")
    db.add(document)
    db.flush()
    version, checksum = _make_pending_version(
        db,
        document,
        current_user,
        filename,
        content_type,
        PurePosixPath(filename).suffix.lower().lstrip("."),
        content,
    )
    try:
        db.commit()
        db.refresh(document)
        db.refresh(version)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Document metadata could not be initialized.",
        ) from exc

    version_status = await _store_and_publish_version(
        db,
        request,
        document,
        version,
        current_user,
        content,
        checksum=checksum,
        record_upload_success=True,
    )
    if version_status == "FAILED":
        raise HTTPException(
            status_code=503,
            detail="Document storage is unavailable. No document was stored; please retry later.",
        )
    db.refresh(document)
    db.expire(document, ["current_version"])
    db.refresh(version)
    document_response = _document_response(db, document, current_user)
    document_response.latest_uploaded_version_number = version.version_number
    document_response.latest_uploaded_version_status = version_status
    return document_response


@router.get("/my", response_model=DocumentListResponse)
async def list_my_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    documents = list(
        db.execute(
            select(Document)
            .options(joinedload(Document.owner), joinedload(Document.current_version))
            .where(
                Document.owner_user_id == current_user.id,
                Document.status != "DELETED",
                Document.current_version_id.is_not(None),
            )
            .order_by(Document.updated_at.desc())
        ).unique().scalars()
    )
    return _list_response(db, documents, current_user)


@router.get("/summary", response_model=DocumentSummaryResponse)
async def get_document_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentSummaryResponse:
    now = utc_now()
    owned = db.scalar(
        select(func.count()).select_from(Document).where(
            Document.owner_user_id == current_user.id,
            Document.status != "DELETED",
            Document.current_version_id.is_not(None),
        )
    ) or 0
    shared_with_me = db.scalar(
        select(func.count())
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .where(
            DocumentPermission.user_id == current_user.id,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            Document.status == "ACTIVE",
            Document.current_version_id.is_not(None),
        )
    ) or 0
    shared_by_me = db.scalar(
        select(func.count())
        .select_from(DocumentPermission)
        .join(Document, Document.id == DocumentPermission.document_id)
        .where(
            Document.owner_user_id == current_user.id,
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            Document.status == "ACTIVE",
            Document.current_version_id.is_not(None),
        )
    ) or 0
    result = DocumentSummaryResponse(
        owned_documents=owned,
        shared_with_me=shared_with_me,
        shared_by_me=shared_by_me,
    )
    if current_user.role == UserRole.ADMIN:
        result.organization_documents = db.scalar(
            select(func.count()).select_from(Document).where(
                Document.status != "DELETED",
            )
        ) or 0
        result.active_documents = db.scalar(
            select(func.count()).select_from(Document).where(
                Document.status == "ACTIVE",
            )
        ) or 0
        result.deleted_documents = db.scalar(
            select(func.count()).select_from(Document).where(
                Document.status == "DELETED",
            )
        ) or 0
        result.active_permissions = db.scalar(
            select(func.count())
            .select_from(DocumentPermission)
            .join(Document, Document.id == DocumentPermission.document_id)
            .where(
                Document.status == "ACTIVE",
                DocumentPermission.revoked_at.is_(None),
                (DocumentPermission.expires_at.is_(None))
                | (DocumentPermission.expires_at > now),
                Document.current_version_id.is_not(None),
            )
        ) or 0
    return result


@router.get("/shared", response_model=DocumentListResponse)
async def list_shared_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    documents = list(
        db.execute(
            select(Document)
            .join(
                DocumentPermission,
                DocumentPermission.document_id == Document.id,
            )
            .options(joinedload(Document.owner), joinedload(Document.current_version))
            .where(
                DocumentPermission.user_id == current_user.id,
                DocumentPermission.revoked_at.is_(None),
                DocumentPermission.can_view.is_(True),
                (DocumentPermission.expires_at.is_(None))
                | (DocumentPermission.expires_at > utc_now()),
                Document.status == "ACTIVE",
                Document.current_version_id.is_not(None),
            )
            .order_by(Document.updated_at.desc())
        ).unique().scalars()
    )
    return _list_response(db, documents, current_user)


@router.get("/registry", response_model=DocumentListResponse)
async def list_document_registry(
    current_admin: User = Depends(require_admin),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    include_deleted: bool = False,
    search: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=80),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        pattern="^(ACTIVE|ARCHIVED|DELETED)$",
    ),
    access_level: str | None = Query(
        default=None,
        pattern="^(SHARED|PRIVATE)$",
    ),
    registry_scope: str | None = Query(
        default=None,
        pattern="^(OWNED|SHARED_WITH_ME)$",
    ),
    document_id: uuid.UUID | None = None,
    file_type: str | None = Query(default=None, max_length=20, pattern="^[A-Za-z0-9]+$"),
    owner_id: uuid.UUID | None = None,
    sort_by: str = Query(
        default="created_at",
        pattern="^(title|owner|category|created_at|updated_at|status|size_bytes|file_type|active_users)$",
    ),
    sort_direction: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    filters = []
    if status_filter:
        filters.append(Document.status == status_filter)
    elif not include_deleted:
        filters.append(Document.status != "DELETED")
    if category:
        filters.append(Document.category == category)
    if document_id:
        filters.append(Document.id == document_id)
    if owner_id:
        filters.append(Document.owner_user_id == owner_id)
    if registry_scope == "OWNED":
        filters.append(Document.owner_user_id == current_admin.id)
    elif registry_scope == "SHARED_WITH_ME":
        filters.append(
            Document.owner_user_id != current_admin.id,
        )
        filters.append(
            Document.status == "ACTIVE",
        )
        filters.append(Document.current_version_id.is_not(None))
        filters.append(
            exists(
                select(1).select_from(DocumentPermission).where(
                    DocumentPermission.document_id == Document.id,
                    DocumentPermission.user_id == current_admin.id,
                    DocumentPermission.can_view.is_(True),
                    DocumentPermission.revoked_at.is_(None),
                    (DocumentPermission.expires_at.is_(None))
                    | (DocumentPermission.expires_at > utc_now()),
                )
            )
        )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        owner_search = aliased(User)
        version_search = aliased(DocumentVersion)
        filters.append(
            Document.title.ilike(pattern)
            | Document.description.ilike(pattern)
            | cast(Document.id, String).ilike(pattern)
            | Document.category.ilike(pattern)
            | exists(
                select(1).select_from(owner_search).where(
                    owner_search.id == Document.owner_user_id,
                    owner_search.full_name.ilike(pattern)
                    | owner_search.email.ilike(pattern),
                )
            )
            | exists(
                select(1).select_from(version_search).where(
                    version_search.id == Document.current_version_id,
                    version_search.original_filename.ilike(pattern),
                )
            )
        )
    if file_type:
        file_type_version = aliased(DocumentVersion)
        filters.append(
            exists(
                select(1).select_from(file_type_version).where(
                    file_type_version.id == Document.current_version_id,
                    func.lower(file_type_version.file_extension) == file_type.lower(),
                )
            )
        )
    now = utc_now()
    active_grant = exists(
        select(1).select_from(DocumentPermission).where(
            DocumentPermission.document_id == Document.id,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            Document.status == "ACTIVE",
            Document.current_version_id.is_not(None),
        )
    )
    if access_level == "SHARED":
        filters.extend((Document.status == "ACTIVE", active_grant))
    elif access_level == "PRIVATE":
        filters.append(~active_grant)

    count_statement = select(func.count()).select_from(Document).where(*filters)
    total = db.scalar(
        count_statement
    ) or 0
    active_permission_count = (
        select(func.count(func.distinct(DocumentPermission.user_id)))
        .select_from(DocumentPermission)
        .where(
            DocumentPermission.document_id == Document.id,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            Document.status == "ACTIVE",
            Document.current_version_id.is_not(None),
        )
        .correlate(Document)
        .scalar_subquery()
    )
    sort_columns = {
        "title": Document.title,
        "owner": User.full_name,
        "category": Document.category,
        "created_at": Document.created_at,
        "updated_at": Document.updated_at,
        "status": Document.status,
        "size_bytes": DocumentVersion.size_bytes,
        "file_type": DocumentVersion.file_extension,
        "active_users": active_permission_count,
    }
    sort_column = sort_columns[sort_by]
    query = (
        select(Document)
        .options(joinedload(Document.owner), joinedload(Document.current_version))
        .outerjoin(User, User.id == Document.owner_user_id)
        .outerjoin(DocumentVersion, DocumentVersion.id == Document.current_version_id)
        .where(*filters)
        .order_by(
            sort_column.desc() if sort_direction == "desc" else sort_column.asc(),
            Document.id.asc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    documents = list(db.execute(query).unique().scalars())
    result = _list_response(db, documents, current_admin, registry=True)
    result.total = total
    result.page = page
    result.page_size = page_size
    return result


@router.get(
    "/registry/summary",
    response_model=DocumentRegistrySummaryResponse,
)
async def get_document_registry_summary(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DocumentRegistrySummaryResponse:
    live_documents = Document.status != "DELETED"
    total = db.scalar(
        select(func.count()).select_from(Document).where(live_documents)
    ) or 0
    owned = db.scalar(
        select(func.count()).select_from(Document).where(
            live_documents,
            Document.owner_user_id == current_admin.id,
        )
    ) or 0
    now = utc_now()
    shared = db.scalar(
        select(func.count(func.distinct(Document.id)))
        .select_from(Document)
        .join(
            DocumentPermission,
            DocumentPermission.document_id == Document.id,
        )
        .where(
            Document.owner_user_id != current_admin.id,
            DocumentPermission.user_id == current_admin.id,
            DocumentPermission.can_view.is_(True),
            DocumentPermission.revoked_at.is_(None),
            (DocumentPermission.expires_at.is_(None))
            | (DocumentPermission.expires_at > now),
            Document.status == "ACTIVE",
            Document.current_version_id.is_not(None),
        )
    ) or 0
    storage = db.scalar(
        select(func.coalesce(func.sum(DocumentVersion.size_bytes), 0))
        .select_from(Document)
        .join(DocumentVersion, DocumentVersion.id == Document.current_version_id)
        .where(live_documents)
    ) or 0
    return DocumentRegistrySummaryResponse(
        total_documents=total,
        owned_documents=owned,
        shared_documents=shared,
        storage_bytes=storage,
    )


@router.get(
    "/registry/categories",
    response_model=DocumentCategoryListResponse,
)
async def get_document_registry_categories(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DocumentCategoryListResponse:
    rows = db.execute(
        select(Document.category, func.count(Document.id))
        .where(
            Document.status != "DELETED",
            Document.category.is_not(None),
            func.length(func.trim(Document.category)) > 0,
        )
        .group_by(Document.category)
        .order_by(func.lower(Document.category), Document.category)
    )
    items = [
        DocumentCategoryCount(name=name, count=count)
        for name, count in rows
    ]
    total = db.scalar(
        select(func.count()).select_from(Document).where(
            Document.status != "DELETED",
        )
    ) or 0
    return DocumentCategoryListResponse(total=total, items=items)


@router.get("/users", response_model=list[UserOption])
async def list_permission_recipients(
    search: str | None = Query(default=None, max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserOption]:
    statement = select(User.id, User.full_name, User.email).where(
        User.account_status == AccountStatus.ACTIVE,
        User.id != current_user.id,
    )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            User.full_name.ilike(pattern) | User.email.ilike(pattern)
        )
    rows = db.execute(statement.order_by(User.full_name).limit(50)).mappings()
    return [UserOption(**row) for row in rows]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document_metadata(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    document = require_access(
        db,
        request,
        get_document(db, document_id),
        current_user,
        "view",
        requested_id=document_id,
    )
    return _document_response(db, document, current_user)


@router.get("/{document_id}/versions", response_model=DocumentVersionListResponse)
async def list_document_versions(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentVersionListResponse:
    document = require_access(
        db,
        request,
        get_document(db, document_id),
        current_user,
        "view",
        requested_id=document_id,
    )
    versions = db.execute(
        select(DocumentVersion)
        .options(joinedload(DocumentVersion.uploaded_by))
        .where(
            DocumentVersion.document_id == document.id,
            DocumentVersion.status == "AVAILABLE",
        )
        .order_by(DocumentVersion.version_number.desc())
    ).unique().scalars()
    return DocumentVersionListResponse(
        items=[
            DocumentVersionResponse(
                id=version.id,
                version_number=version.version_number,
                original_filename=version.original_filename,
                file_extension=version.file_extension,
                content_type=version.content_type,
                size_bytes=version.size_bytes,
                checksum_sha256=version.checksum_sha256,
                status=version.status,
                uploaded_by_user_id=version.uploaded_by_user_id,
                uploaded_by_name=version.uploaded_by.full_name,
                uploaded_at=version.uploaded_at,
                scan_completed_at=version.scan_completed_at,
            )
            for version in versions
        ]
    )


async def get_document_viewer_user(
    document_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Reuse session authentication and audit unauthenticated preview attempts."""
    try:
        return await get_current_user(request, db)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            record_audit(
                db,
                request,
                actor_user_id=None,
                action_type="DOCUMENT_VIEWED",
                result="DENIED",
                document_id=document_id,
                details={"reason": "authentication_required"},
            )
            db.commit()
        raise


@router.get("/{document_id}/view")
async def view_document(
    document_id: uuid.UUID,
    request: Request,
    version_id: uuid.UUID | None = None,
    current_user: User = Depends(get_document_viewer_user),
    db: Session = Depends(get_db),
):
    document, version = _load_accessible_version(
        db,
        request,
        document_id,
        version_id,
        current_user,
        "view",
    )
    try:
        s3_object = await run_in_threadpool(
            get_s3_document,
            version.storage_key,
            version.s3_version_id,
        )
        _verify_object_size(s3_object, version)
    except StorageObjectNotFoundError as exc:
        logger.error("Authorized document preview source is missing")
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="DOCUMENT_VIEWED",
            result="FAILED",
            document=document,
            details={"version_id": str(version.id), "reason": "storage_object_missing"},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The document file could not be found.",
        ) from exc
    except Exception as exc:
        logger.error("Document preview retrieval failed (%s)", type(exc).__name__)
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="DOCUMENT_VIEWED",
            result="FAILED",
            document=document,
            details={"version_id": str(version.id), "reason": "storage_unavailable"},
        )
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="The document file is temporarily unavailable.",
        ) from exc
    def mark_stream_failure(exc: Exception) -> None:
        logger.error("Document preview stream failed (%s)", type(exc).__name__)
        try:
            record_audit(
                db,
                request,
                actor_user_id=current_user.id,
                action_type="DOCUMENT_VIEWED",
                result="FAILED",
                document=document,
                details={
                    "version_id": str(version.id),
                    "reason": "stream_interrupted",
                },
            )
            db.commit()
        except Exception as audit_error:
            logger.error(
                "Document preview stream failure could not be audited (%s)",
                type(audit_error).__name__,
            )

    return _file_response(
        s3_object,
        version,
        inline=True,
        on_stream_error=mark_stream_failure,
    )


@router.post("/{document_id}/preview-success", status_code=status.HTTP_204_NO_CONTENT)
async def report_document_preview_success(
    document_id: uuid.UUID,
    request: Request,
    version_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Record a view only after the authorized client rendered the retrieved version."""
    document, version = _load_accessible_version(
        db,
        request,
        document_id,
        version_id,
        current_user,
        "view",
    )
    record_audit(
        db,
        request,
        actor_user_id=current_user.id,
        action_type="DOCUMENT_VIEWED",
        result="SUCCESS",
        document=document,
        details={"version_id": str(version.id)},
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{document_id}/preview-failure", status_code=status.HTTP_204_NO_CONTENT)
async def report_document_preview_failure(
    document_id: uuid.UUID,
    request: Request,
    version_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Audit a client-side rendering failure after a successful file retrieval."""
    document, version = _load_accessible_version(
        db,
        request,
        document_id,
        version_id,
        current_user,
        "view",
    )
    record_audit(
        db,
        request,
        actor_user_id=current_user.id,
        action_type="DOCUMENT_VIEWED",
        result="FAILED",
        document=document,
        details={
            "version_id": str(version.id),
            "reason": "client_preview_failed",
            "stage": "render",
        },
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{document_id}/download")
@router.get("/{document_id}/versions/{version_id}/download")
async def download_document(
    document_id: uuid.UUID,
    request: Request,
    version_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document, version = _load_accessible_version(
        db,
        request,
        document_id,
        version_id,
        current_user,
        "download",
    )
    try:
        s3_object = await run_in_threadpool(
            get_s3_document,
            version.storage_key,
            version.s3_version_id,
        )
        _verify_object_size(s3_object, version)
    except StorageObjectNotFoundError as exc:
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="DOCUMENT_DOWNLOADED",
            result="FAILED",
            document=document,
            details={"version_id": str(version.id), "reason": "storage_object_missing"},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The document file could not be found.",
        ) from exc
    except StorageUnavailableError as exc:
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="DOCUMENT_DOWNLOADED",
            result="FAILED",
            document=document,
            details={"version_id": str(version.id), "reason": "storage_unavailable"},
        )
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    record_audit(
        db,
        request,
        actor_user_id=current_user.id,
        action_type="DOCUMENT_DOWNLOADED",
        result="SUCCESS",
        document=document,
        details={"version_id": str(version.id)},
    )
    db.commit()
    return _file_response(s3_object, version, inline=False)


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document_metadata(
    document_id: uuid.UUID,
    body: DocumentMetadataUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    document = _editable_document(db, request, document_id, current_user, "edit_metadata")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No metadata changes provided.")
    if any(changes.get(field) is None for field in ("title", "classification")):
        raise HTTPException(
            status_code=422,
            detail="Title and classification cannot be null.",
        )
    for field, value in changes.items():
        setattr(document, field, value)
    document.updated_at = utc_now()
    record_audit(
        db,
        request,
        actor_user_id=current_user.id,
        action_type="DOCUMENT_METADATA_UPDATED",
        result="SUCCESS",
        document=document,
        details={"updated_fields": sorted(changes)},
    )
    db.commit()
    db.refresh(document)
    return _document_response(db, document, current_user)


@router.post(
    "/{document_id}/versions",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def replace_document_file(
    document_id: uuid.UUID,
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    document = _editable_document(
        db,
        request,
        document_id,
        current_user,
        "replace_file",
    )
    try:
        filename, content_type, content = await _read_upload(file)
    except HTTPException as exc:
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="UPLOAD_REJECTED",
            result="DENIED",
            document=document,
            details={"http_status": exc.status_code, "operation": "replace"},
        )
        db.commit()
        raise
    version, checksum = _make_pending_version(
        db,
        document,
        current_user,
        filename,
        content_type,
        PurePosixPath(filename).suffix.lower().lstrip("."),
        content,
    )
    version_id = version.id
    try:
        db.commit()
        db.refresh(version)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Document version metadata could not be initialized.",
        ) from exc
    try:
        version.status = "PENDING_SCAN"
        document.updated_at = utc_now()
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="DOCUMENT_VERSION_CREATED",
            result="SUCCESS",
            document=document,
            details={
                "version_id": str(version.id),
                "version_number": version.version_number,
                "status": version.status,
            },
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        failed_version = db.get(DocumentVersion, version_id)
        if failed_version is not None:
            failed_version.status = "FAILED"
            failed_document = db.get(Document, document.id)
            record_audit(
                db,
                request,
                actor_user_id=current_user.id,
                action_type="UPLOAD_REJECTED",
                result="FAILED",
                document=failed_document,
                document_id=document.id,
                details={
                    "version_id": str(version_id),
                    "operation": "replace",
                    "reason": "database_finalize",
                },
            )
            try:
                db.commit()
            except SQLAlchemyError:
                db.rollback()
                logger.error("Could not mark failed replacement version in PostgreSQL")
        raise HTTPException(
            status_code=503,
            detail="The replacement could not be finalized. Please retry.",
        ) from exc
    version_status = await _store_and_publish_version(
        db,
        request,
        document,
        version,
        current_user,
        content,
        checksum=checksum,
    )
    if version_status == "FAILED":
        raise HTTPException(
            status_code=503,
            detail="Document storage is unavailable. No document was stored; please retry later.",
        )
    db.refresh(document)
    db.expire(document, ["current_version"])
    db.refresh(version)
    document_response = _document_response(db, document, current_user)
    document_response.latest_uploaded_version_number = version.version_number
    document_response.latest_uploaded_version_status = version_status
    return document_response


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    document = _owner_document(
        db,
        request,
        document_id,
        current_user,
        "delete",
        forbidden_for_existing_document=True,
    )
    document.status = "DELETED"
    document.deleted_at = utc_now()
    document.deleted_by_user_id = current_user.id
    document.updated_at = document.deleted_at
    record_audit(
        db,
        request,
        actor_user_id=current_user.id,
        action_type="DOCUMENT_DELETED",
        result="SUCCESS",
        document=document,
        details={"soft_delete": True},
    )
    db.commit()


@router.get(
    "/{document_id}/permissions",
    response_model=DocumentPermissionListResponse,
)
async def list_document_permissions(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentPermissionListResponse:
    document = _owner_document(
        db,
        request,
        document_id,
        current_user,
        "list_permissions",
    )
    recipient = aliased(User)
    grantor = aliased(User)
    rows = db.execute(
        select(DocumentPermission, recipient, grantor)
        .join(recipient, recipient.id == DocumentPermission.user_id)
        .join(grantor, grantor.id == DocumentPermission.granted_by_user_id)
        .where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id != document.owner_user_id,
        )
        .order_by(DocumentPermission.granted_at.desc())
    ).all()
    return DocumentPermissionListResponse(
        items=[
            DocumentPermissionResponse(
                id=permission.id,
                user_id=permission.user_id,
                user_name=user.full_name,
                user_email=user.email,
                user_role=user.role.value,
                user_department=user.department,
                user_job_title=user.job_title,
                user_account_status=user.account_status.value,
                can_view=permission.can_view,
                can_download=permission.can_download,
                can_edit=permission.can_edit,
                granted_by_user_id=permission.granted_by_user_id,
                granted_by_name=granted_by.full_name,
                granted_at=permission.granted_at,
                expires_at=permission.expires_at,
                revoked_at=permission.revoked_at,
                revoked_by_user_id=permission.revoked_by_user_id,
                is_effective=permission.is_effective,
                updated_at=permission.updated_at,
                status=_permission_status(permission, document, user),
            )
            for permission, user, granted_by in rows
        ]
    )


@router.put(
    "/{document_id}/permissions",
    response_model=DocumentPermissionResponse,
)
async def grant_document_permission(
    document_id: uuid.UUID,
    body: PermissionGrantRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentPermissionResponse:
    document = _owner_document(
        db,
        request,
        document_id,
        current_user,
        "grant_permission",
    )
    if document.current_version is None or document.current_version.status != "AVAILABLE":
        raise HTTPException(
            status_code=409,
            detail="This document is not currently available for sharing.",
        )
    recipient = db.get(User, body.user_id)
    if (
        recipient is None
        or recipient.account_status != AccountStatus.ACTIVE
        or recipient.id == document.owner_user_id
    ):
        raise HTTPException(status_code=422, detail="Select an eligible active user.")
    if body.expires_at is not None and body.expires_at <= utc_now():
        raise HTTPException(status_code=422, detail="Expiration must be in the future.")
    grant = permission_for(db, document.id, recipient.id)
    now = utc_now()
    if grant is None:
        grant = DocumentPermission(
            document_id=document.id,
            user_id=recipient.id,
            can_view=body.can_view,
            can_download=body.can_download,
            can_edit=body.can_edit,
            granted_by_user_id=current_user.id,
            granted_at=now,
            expires_at=body.expires_at,
        )
        db.add(grant)
    else:
        grant.can_view = body.can_view
        grant.can_download = body.can_download
        grant.can_edit = body.can_edit
        grant.granted_by_user_id = current_user.id
        grant.granted_at = now
        grant.expires_at = body.expires_at
        grant.revoked_at = None
        grant.revoked_by_user_id = None
        grant.updated_at = now
    record_audit(
        db,
        request,
        actor_user_id=current_user.id,
        action_type="PERMISSION_GRANTED",
        result="SUCCESS",
        document=document,
        target_user_id=recipient.id,
        details={
            "can_view": body.can_view,
            "can_download": body.can_download,
            "can_edit": body.can_edit,
            "expires_at": body.expires_at.isoformat() if body.expires_at else None,
        },
    )
    add_notification(
        db,
        recipient_user_id=recipient.id,
        actor_user_id=current_user.id,
        notification_type="ACCESS_GRANTED",
        title="Document access granted",
        message=f"{current_user.full_name} shared {document.title} with you.",
        preference_key="access_granted",
        document_id=document.id,
        metadata={"permission_id": str(grant.id)},
    )
    db.commit()
    db.refresh(grant)
    return DocumentPermissionResponse(
        id=grant.id,
        user_id=grant.user_id,
        user_name=recipient.full_name,
        user_email=recipient.email,
        user_role=recipient.role.value,
        user_department=recipient.department,
        user_job_title=recipient.job_title,
        user_account_status=recipient.account_status.value,
        can_view=grant.can_view,
        can_download=grant.can_download,
        can_edit=grant.can_edit,
        granted_by_user_id=grant.granted_by_user_id,
        granted_by_name=current_user.full_name,
        granted_at=grant.granted_at,
        expires_at=grant.expires_at,
        revoked_at=grant.revoked_at,
        revoked_by_user_id=grant.revoked_by_user_id,
        is_effective=grant.is_effective,
        updated_at=grant.updated_at,
        status=_permission_status(grant, document, recipient),
    )


@router.delete(
    "/{document_id}/permissions/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_document_permission(
    document_id: uuid.UUID,
    permission_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    document = _owner_document(
        db,
        request,
        document_id,
        current_user,
        "revoke_permission",
    )
    grant = db.get(DocumentPermission, permission_id)
    if (
        grant is None
        or grant.document_id != document.id
        or grant.user_id == document.owner_user_id
    ):
        raise HTTPException(status_code=404, detail="Permission not found.")
    if grant.revoked_at is None:
        grant.revoked_at = utc_now()
        grant.revoked_by_user_id = current_user.id
        grant.updated_at = grant.revoked_at
        record_audit(
            db,
            request,
            actor_user_id=current_user.id,
            action_type="PERMISSION_REVOKED",
            result="SUCCESS",
            document=document,
            target_user_id=grant.user_id,
            details={"permission_id": str(grant.id)},
        )
        add_notification(
            db,
            recipient_user_id=grant.user_id,
            actor_user_id=current_user.id,
            notification_type="ACCESS_REVOKED",
            title="Document access revoked",
            message=f"Access to {document.title} was revoked.",
            preference_key="access_revoked",
            document_id=document.id,
            metadata={"permission_id": str(grant.id)},
        )
        db.commit()


@router.get(
    "/{document_id}/audit",
    response_model=DocumentAuditListResponse,
)
async def list_document_audit(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAuditListResponse:
    document = require_access(
        db,
        request,
        get_document(db, document_id),
        current_user,
        "view",
        requested_id=document_id,
    )
    actor = aliased(User)
    target = aliased(User)
    rows = db.execute(
        select(DocumentAuditLog, actor, target)
        .outerjoin(actor, actor.id == DocumentAuditLog.actor_user_id)
        .outerjoin(target, target.id == DocumentAuditLog.target_user_id)
        .where(DocumentAuditLog.document_id_snapshot == document.id)
        .order_by(DocumentAuditLog.occurred_at.desc())
        .limit(200)
    ).all()
    return DocumentAuditListResponse(
        items=[
            DocumentAuditResponse(
                id=event.id,
                document_id_snapshot=event.document_id_snapshot,
                actor_user_id=event.actor_user_id,
                actor_name=actor_user.full_name if actor_user else None,
                actor_department=actor_user.department if actor_user else None,
                target_user_id=event.target_user_id,
                target_name=target_user.full_name if target_user else None,
                action_type=event.action_type,
                result=event.result,
                occurred_at=event.occurred_at,
                ip_address=event.ip_address,
                request_id=event.request_id,
                details=event.details,
            )
            for event, actor_user, target_user in rows
        ]
    )
