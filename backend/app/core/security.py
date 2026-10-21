"""
Security utilities — password hashing, session tokens, and CSRF.

Uses pwdlib with Argon2id for password hashing.
Uses secrets module for cryptographically secure token generation.
Uses hashlib SHA-256 for session-token hashing (the token itself is the secret).
"""

from __future__ import annotations

import hashlib
import logging
import secrets

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Password hashing — Argon2id via pwdlib
# ---------------------------------------------------------------------------

# OWASP minimum guidance for Argon2id (2023):
#   memory_cost >= 19 MiB (19456 KiB), time_cost >= 2, parallelism >= 1
# We use the pwdlib default Argon2Hasher which uses argon2id with sensible
# parameters: m=65536 (64 MiB), t=3, p=4 — exceeding the OWASP minimum.
_argon2_hasher = Argon2Hasher()
_password_hash = PasswordHash((_argon2_hasher,))


def hash_password(password: str) -> str:
    """Hash a password using Argon2id. Returns the encoded hash string."""
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against an Argon2id hash. Returns True if correct."""
    try:
        return _password_hash.verify(password, password_hash)
    except Exception:
        # Any verification error (corrupt hash, wrong format) => reject.
        return False


# ---------------------------------------------------------------------------
# Session tokens
# ---------------------------------------------------------------------------

def generate_session_token() -> str:
    """Generate a cryptographically secure 256-bit session token (hex-encoded)."""
    return secrets.token_hex(32)


def hash_session_token(token: str) -> str:
    """
    Hash a session token with SHA-256 for storage.
    The raw token is the secret — we only store the hash.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# CSRF token
# ---------------------------------------------------------------------------

def generate_csrf_token() -> str:
    """Generate a 128-bit CSRF token."""
    return secrets.token_hex(16)
