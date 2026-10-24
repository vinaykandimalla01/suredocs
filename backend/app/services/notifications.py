"""Notification preference defaults and scoped notification creation."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.persistence import Notification, UserPreference

DEFAULT_NOTIFICATION_SETTINGS: dict[str, bool] = {
    "document_access_requests": True,
    "access_granted": True,
    "access_revoked": True,
    "access_request_decisions": True,
    "document_activity": True,
    "security_alerts": True,
    "product_updates": False,
    "marketing_communications": False,
}

DEFAULT_DISPLAY_SETTINGS: dict[str, str] = {
    "appearance": "light",
    "language": "English (US)",
    "date_format": "Oct 24, 2026",
    "time_format": "12-hour (AM/PM)",
    "default_view": "list",
}


def preferences_for(db: Session, user_id: uuid.UUID) -> UserPreference:
    preferences = db.get(UserPreference, user_id)
    if preferences is None:
        preferences = UserPreference(
            user_id=user_id,
            notification_settings=DEFAULT_NOTIFICATION_SETTINGS.copy(),
            display_settings=DEFAULT_DISPLAY_SETTINGS.copy(),
        )
        db.add(preferences)
        db.flush()
    return preferences


def add_notification(
    db: Session,
    *,
    recipient_user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    preference_key: str,
    actor_user_id: uuid.UUID | None = None,
    document_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> Notification | None:
    if actor_user_id == recipient_user_id:
        return None
    preferences = db.get(UserPreference, recipient_user_id)
    settings = (
        preferences.notification_settings
        if preferences is not None
        else DEFAULT_NOTIFICATION_SETTINGS
    )
    if settings.get(preference_key, True) is False:
        return None
    notification = Notification(
        recipient_user_id=recipient_user_id,
        actor_user_id=actor_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        document_id=document_id,
        metadata_json=metadata or {},
    )
    db.add(notification)
    return notification
