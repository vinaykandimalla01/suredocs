"""
Application configuration.

Loads settings from the secrets directory and environment.
Never hardcodes credentials or secrets.
"""

from __future__ import annotations

import os
from pathlib import Path


# ---------------------------------------------------------------------------
# Project root resolution
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[3]

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

DB_USERNAME: str = os.getenv("SUREDOCS_DB_USER", "suredocs_app")
DB_HOST: str = os.getenv("SUREDOCS_DB_HOST", "127.0.0.1")
DB_PORT: int = int(os.getenv("SUREDOCS_DB_PORT", "5432"))
DB_NAME: str = os.getenv("SUREDOCS_DB_NAME", "suredocs")
DB_PASSWORD: str = _read_secret_file("suredocs_app_password.txt")

# ---------------------------------------------------------------------------
# Session / cookie settings
# ---------------------------------------------------------------------------

# Read a dedicated session-signing secret, or generate one if the file
# doesn't exist yet (for first-time local development).
_SESSION_SECRET_PATH = PROJECT_ROOT / "secrets" / "session_secret.txt"

def _load_or_create_session_secret() -> str:
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
COOKIE_SAMESITE: str = "lax"
COOKIE_PATH: str = "/"

# In production set SUREDOCS_SECURE_COOKIES=true
COOKIE_SECURE: bool = os.getenv("SUREDOCS_SECURE_COOKIES", "false").lower() == "true"

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
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# ---------------------------------------------------------------------------
# Login abuse protection
# ---------------------------------------------------------------------------

MAX_FAILED_LOGIN_ATTEMPTS: int = 5
LOCKOUT_DURATION_SECONDS: int = 15 * 60  # 15 minutes

# Private document object storage settings; AWS credentials use the SDK chain.
AWS_REGION: str = os.getenv("SUREDOCS_AWS_REGION", "ap-south-1")
AWS_MFA_KMS_KEY_ID: str | None = os.getenv("SUREDOCS_MFA_KMS_KEY_ID") or None
S3_BUCKET: str = os.getenv(
    "SUREDOCS_S3_BUCKET",
    "suredocs-private-documents-dev",
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
