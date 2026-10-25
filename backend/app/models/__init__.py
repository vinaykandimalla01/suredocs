# Models package — import all models here for Alembic metadata discovery.
from app.models.user import User  # noqa: F401
from app.models.user_session import UserSession  # noqa: F401
from app.models.auth_event import AuthEvent  # noqa: F401
from app.models.password_reset_token import PasswordResetToken  # noqa: F401
from app.models.documents import (  # noqa: F401
    Document,
    DocumentAuditLog,
    DocumentPermission,
    DocumentScan,
    DocumentVersion,
)
from app.models.persistence import (  # noqa: F401
    AccessRequest,
    DocumentAuditSecurityFlag,
    Notification,
    UserMfaMethod,
    UserPreference,
)
