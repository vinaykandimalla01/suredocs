"""
Application configuration.

Loads settings from the environment and local development secret files.
Never hardcodes credentials or secrets.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

# ---------------------------------------------------------------------------
# Project root resolution
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[3]
IS_PRODUCTION: bool = (
    os.getenv("VERCEL") == "1"
    or os.getenv("VERCEL_ENV", "").strip().lower() == "production"
    or os.getenv("SUREDOCS_ENVIRONMENT", "").strip().lower() == "production"
)
if not IS_PRODUCTION:
    load_dotenv(PROJECT_ROOT / ".env.local", override=False)

# ---------------------------------------------------------------------------
# Secret loading helpers
# ---------------------------------------------------------------------------

def _read_secret_file(relative_path: str) -> str:
    """Read a trimmed secret from a file relative to `secrets/`."""
    path = PROJECT_ROOT / "secrets" / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Secret file not found: {path}")
    value = path.read_text(encoding="utf-8").strip()
    if not value:
        raise RuntimeError(f"Secret file is empty: {path}")
    return value


# ---------------------------------------------------------------------------
# Database settings
# ---------------------------------------------------------------------------

DATABASE_URL: str | None = os.getenv("DATABASE_URL") or None
DATABASE_URL_UNPOOLED: str | None = os.getenv("DATABASE_URL_UNPOOLED") or None


def _load_database_password() -> str | None:
    password = os.getenv("DB_PASSWORD")
    if password:
        return password
    if IS_PRODUCTION:
        return None
    return _read_secret_file("suredocs_app_password.txt")


if DATABASE_URL:
    try:
        _parsed_database_url = make_url(DATABASE_URL)
    except (ArgumentError, TypeError, ValueError) as exc:
        raise RuntimeError("DATABASE_URL is not a valid PostgreSQL URL.") from exc
    if _parsed_database_url.get_backend_name() != "postgresql":
        raise RuntimeError("DATABASE_URL must use PostgreSQL.")
    if IS_PRODUCTION and _parsed_database_url.host in {
        "localhost",
        "127.0.0.1",
        "::1",
    }:
        raise RuntimeError("DATABASE_URL must reference a hosted PostgreSQL server.")
    DB_USERNAME: str | None = _parsed_database_url.username
    DB_HOST: str | None = _parsed_database_url.host
    DB_PORT: int = _parsed_database_url.port or 5432
    DB_NAME: str | None = _parsed_database_url.database
    DB_PASSWORD: str | None = _parsed_database_url.password
    DB_CONFIGURATION_MISSING: tuple[str, ...] = (
        ("DATABASE_URL",)
        if not all((DB_USERNAME, DB_HOST, DB_NAME, DB_PASSWORD))
        else ()
    )
else:
    DB_USERNAME = os.getenv("SUREDOCS_DB_USER") or (
        None if IS_PRODUCTION else "suredocs_app"
    )
    DB_HOST = os.getenv("SUREDOCS_DB_HOST") or (
        None if IS_PRODUCTION else "127.0.0.1"
    )
    DB_PORT = int(os.getenv("SUREDOCS_DB_PORT", "5432"))
    DB_NAME = os.getenv("SUREDOCS_DB_NAME") or (
        None if IS_PRODUCTION else "suredocs"
    )
    DB_PASSWORD = _load_database_password()
    DB_CONFIGURATION_MISSING = tuple(
        name
        for name, value in (
            ("SUREDOCS_DB_USER", DB_USERNAME),
            ("SUREDOCS_DB_HOST", DB_HOST),
            ("SUREDOCS_DB_NAME", DB_NAME),
            ("DB_PASSWORD", DB_PASSWORD),
        )
        if not value
    )
DATABASE_CONFIGURED: bool = not DB_CONFIGURATION_MISSING


# ---------------------------------------------------------------------------
# Session / cookie settings
# ---------------------------------------------------------------------------

# Read a dedicated session-signing secret, or generate one if the file
# doesn't exist yet (for first-time local development).
_SESSION_SECRET_PATH = PROJECT_ROOT / "secrets" / "session_secret.txt"

def _load_or_create_session_secret() -> str:
    configured_secret = os.getenv("SESSION_SECRET")
    if configured_secret:
        if IS_PRODUCTION and len(configured_secret) < 32:
            raise RuntimeError(
                "SESSION_SECRET must contain at least 32 characters in production."
            )
        return configured_secret
    if IS_PRODUCTION:
        raise RuntimeError(
            "SESSION_SECRET is required in production. Configure a stable, "
            "random value in the deployment environment."
        )
    if _SESSION_SECRET_PATH.is_file():
        value = _SESSION_SECRET_PATH.read_text(encoding="utf-8").strip()
        if value:
            return value
    # Generate a strong random secret and persist it.
    import secrets as _secrets
    value = _secrets.token_hex(64)
    _SESSION_SECRET_PATH.write_text(value, encoding="utf-8")
    return value


SESSION_SECRET: str = _load_or_create_session_secret()

# Cookie configuration
COOKIE_NAME: str = "suredocs_session"
COOKIE_HTTPONLY: bool = True
COOKIE_SAMESITE: str = os.getenv("SUREDOCS_COOKIE_SAMESITE", "lax").strip().lower()
COOKIE_PATH: str = "/"

# In production set SUREDOCS_SECURE_COOKIES=true
COOKIE_SECURE: bool = os.getenv("SUREDOCS_SECURE_COOKIES", "false").lower() == "true"
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("SUREDOCS_COOKIE_SAMESITE must be lax, strict, or none.")
if COOKIE_SAMESITE == "none" and not COOKIE_SECURE:
    raise RuntimeError("SUREDOCS_COOKIE_SAMESITE=none requires SUREDOCS_SECURE_COOKIES=true.")

# Session lifetimes (seconds)
SESSION_IDLE_TIMEOUT: int = int(os.getenv("SUREDOCS_SESSION_IDLE_TIMEOUT", str(30 * 60)))  # 30 min
SESSION_ABSOLUTE_TIMEOUT: int = int(os.getenv("SUREDOCS_SESSION_ABSOLUTE_TIMEOUT", str(12 * 60 * 60)))  # 12 h

# ---------------------------------------------------------------------------
# CORS — explicitly allowed frontend origins
# ---------------------------------------------------------------------------

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv(
        "SUREDOCS_CORS_ORIGINS",
        ""
        if IS_PRODUCTION
        else "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# ---------------------------------------------------------------------------
# Login abuse protection
# ---------------------------------------------------------------------------

MAX_FAILED_LOGIN_ATTEMPTS: int = 5
LOCKOUT_DURATION_SECONDS: int = 15 * 60  # 15 minutes

# Private document object storage settings; AWS credentials use the SDK chain.
AWS_REGION: str = os.getenv("AWS_REGION") or os.getenv(
    "SUREDOCS_AWS_REGION", "ap-south-1"
)
AWS_ENDPOINT_URL_S3: str | None = os.getenv("AWS_ENDPOINT_URL_S3") or None
S3_BUCKET: str = os.getenv(
    "SUREDOCS_S3_BUCKET",
    "assets" if AWS_ENDPOINT_URL_S3 else "suredocs-private-documents-dev",
)
MAX_DOCUMENT_SIZE_BYTES: int = 50 * 1024 * 1024
CLAMAV_HOST: str = os.getenv("SUREDOCS_CLAMAV_HOST", "127.0.0.1")
CLAMAV_PORT: int = int(os.getenv("SUREDOCS_CLAMAV_PORT", "3310"))
CLAMAV_TIMEOUT_SECONDS: float = float(
    os.getenv("SUREDOCS_CLAMAV_TIMEOUT_SECONDS", "120")
)
CLAMAV_STREAM_CHUNK_BYTES: int = 64 * 1024

# ---------------------------------------------------------------------------
# Password policy
# ---------------------------------------------------------------------------

PASSWORD_MIN_LENGTH: int = 10
PASSWORD_MAX_LENGTH: int = 128

# ---------------------------------------------------------------------------
# Password recovery email
# ---------------------------------------------------------------------------

SMTP_HOST: str | None = os.getenv("SUREDOCS_SMTP_HOST") or None
SMTP_PORT: int = int(os.getenv("SUREDOCS_SMTP_PORT", "587"))
SMTP_USERNAME: str | None = os.getenv("SUREDOCS_SMTP_USERNAME") or None
SMTP_PASSWORD: str | None = os.getenv("SUREDOCS_SMTP_PASSWORD") or None
SMTP_FROM_EMAIL: str | None = os.getenv("SUREDOCS_SMTP_FROM_EMAIL") or None
PUBLIC_APP_URL: str | None = os.getenv("SUREDOCS_PUBLIC_APP_URL") or None
PASSWORD_RESET_TOKEN_TTL_SECONDS: int = 30 * 60
