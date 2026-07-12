from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog


def log_action(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: int,
) -> ActivityLog:
    """Record an action in the activity log. Call from every mutation service."""
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
