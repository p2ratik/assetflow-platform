from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    user_id: int,
    notif_type: str,
    message: str,
) -> Notification:
    """Create an in-app notification. Call alongside log_action where relevant."""
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        message=message,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
