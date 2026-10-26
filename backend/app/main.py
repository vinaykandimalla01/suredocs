"""
SureDocs FastAPI application entry point.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.core.config import CORS_ORIGINS
from app.routers.auth import router as auth_router
from app.routers.access_requests import router as access_requests_router
from app.routers.dashboard import router as dashboard_router
from app.routers.document_activity import router as document_activity_router
from app.routers.documents import router as documents_router
from app.routers.sharing_permissions import router as sharing_permissions_router
from app.routers.admin_permissions import router as admin_permissions_router
from app.routers.admin_audit import router as admin_audit_router
from app.routers.users import admin_router as admin_users_router
from app.routers.users import employee_router as user_profile_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="SureDocs API",
    description="Enterprise document management — authentication API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


@app.middleware("http")
async def log_api_server_failures(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as exc:
        if request.url.path.startswith("/api/"):
            logging.getLogger("suredocs.api").error(
                "API request failed method=%s path=%s status=500 error_type=%s",
                request.method,
                request.url.path,
                type(exc).__name__,
            )
        raise

    if request.url.path.startswith("/api/") and response.status_code >= 500:
        logging.getLogger("suredocs.api").error(
            "API request failed method=%s path=%s status=%s",
            request.method,
            request.url.path,
            response.status_code,
        )
    return response


@app.get("/docs", include_in_schema=False)
async def redirect_docs() -> RedirectResponse:
    return RedirectResponse(url="/api/docs")


@app.get("/openapi.json", include_in_schema=False)
async def redirect_openapi() -> RedirectResponse:
    return RedirectResponse(url="/api/openapi.json")


# ---------------------------------------------------------------------------
# CORS — only explicitly permitted frontend origins with credentials
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
app.include_router(auth_router)
app.include_router(access_requests_router)
app.include_router(dashboard_router)
app.include_router(admin_users_router)
app.include_router(user_profile_router)
# Keep the static activity paths before /api/documents/{document_id}.
app.include_router(document_activity_router)
app.include_router(documents_router)
app.include_router(sharing_permissions_router)
app.include_router(admin_permissions_router)
app.include_router(admin_audit_router)
