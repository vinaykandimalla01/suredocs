"""
Pydantic schemas for authentication requests and responses.

These schemas never expose password_hash, session tokens, or internal
security counters to the frontend.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator

from app.core.config import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str = Field(..., max_length=320, description="Work email address")
    password: str = Field(
        ...,
        min_length=1,
        max_length=PASSWORD_MAX_LENGTH,
        description="Account password",
    )

    @field_validator("email")
    @classmethod
    def validate_work_email(cls, value: str) -> str:
        normalized = value.strip()
        is_suredocs_test_email = normalized.lower().endswith("@suredocs.test")
        try:
            return validate_email(
                normalized,
                check_deliverability=False,
                test_environment=is_suredocs_test_email,
            ).normalized
        except EmailNotValidError as exc:
            raise ValueError("Enter a valid email address.") from exc

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=320, description="Work email address")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip()
        is_suredocs_test_email = normalized.lower().endswith("@suredocs.test")
        try:
            return validate_email(
                normalized,
                check_deliverability=False,
                test_environment=is_suredocs_test_email,
            ).normalized.lower()
        except EmailNotValidError as exc:
            raise ValueError("Enter a valid email address.") from exc


class ResetPasswordRequest(BaseModel):
    token: str = ""
    new_password: str = ""


class PasswordRecoveryResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    """Safe user representation — no credentials or internal state."""
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    department: str | None = None
    job_title: str | None = None
    employee_code: str | None = None

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    user: UserResponse
    message: str = "Login successful"


class MeResponse(BaseModel):
    user: UserResponse


class LogoutResponse(BaseModel):
    message: str = "Logged out successfully"


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str
    database: str
