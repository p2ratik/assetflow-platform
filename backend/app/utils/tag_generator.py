from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.asset import Asset


def generate_tag(db: Session) -> str:
    """Generate the next sequential asset tag: AF-0001, AF-0002, ..."""
    max_id = db.query(func.count(Asset.id)).scalar() or 0
    next_num = max_id + 1
    return f"AF-{next_num:04d}"
