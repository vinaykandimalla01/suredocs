"""
Pydantic schemas for authentication requests and responses.

These schemas never expose password_hash, session tokens, or internal
security counters to the frontend.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.config import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr = Field(..., max_length=320, description="Work email address")
    password: str = Field(
        ...,
        min_length=1,
        max_length=PASSWORD_MAX_LENGTH,
        description="Account password",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    """Safe user representation — no credentials or internal state."""
    id: uuid.UUID
    full_name: str
    email: str
    role: str

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
