"""
utils/notifier.py
=================
Side-effect helper: create an in-app notification row.
Called from every service function that mutates state.
Never raises — a failed notification must never block the primary operation.
"""
from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    message: str,
) -> None:
    """
    Insert a notification for user_id. Silently swallows errors so callers
    never need try/except around it.

    type examples: 'allocation', 'return', 'transfer', 'booking', 'maintenance'
    """
    try:
        notif = Notification(user_id=user_id, type=type, message=message)
        db.add(notif)
        db.flush()   # part of caller's transaction — committed with them
    except Exception:
        pass  # never block primary operation
