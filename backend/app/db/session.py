"""
SQLAlchemy engine and session factory.

Reads database credentials from the central configuration module.
"""

from __future__ import annotations

from collections.abc import Generator

from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, URL, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import (
    DATABASE_CONFIGURED,
    DATABASE_URL,
    DB_CONFIGURATION_MISSING,
    DB_HOST,
    DB_NAME,
    DB_PASSWORD,
    DB_PORT,
    DB_USERNAME,
)

engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None
if DATABASE_CONFIGURED:
    if DATABASE_URL:
        connection_url = make_url(DATABASE_URL)
        if connection_url.drivername in {"postgres", "postgresql"}:
            connection_url = connection_url.set(drivername="postgresql+psycopg")
    else:
        # Build the connection URL safely, including special characters in the password.
        connection_url = URL.create(
            drivername="postgresql+psycopg",
            username=DB_USERNAME,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
        )
    engine = create_engine(
        connection_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=0,
    )
    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )


# Base class for all SQLAlchemy models.
class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and closes it after use."""
    if SessionLocal is None:
        missing = ", ".join(DB_CONFIGURATION_MISSING)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database configuration is unavailable. Configure: {missing}.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()