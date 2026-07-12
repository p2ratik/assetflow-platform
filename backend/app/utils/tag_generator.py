from sqlalchemy.orm import Session
from sqlalchemy import text


def generate_tag(db: Session) -> str:
    """Generate the next sequential asset tag using a Postgres SEQUENCE.

    Using nextval() is the only correct fix for the TOCTOU race:
    two concurrent requests each get a different sequence value atomically.
    The UNIQUE constraint on assets.tag is a final safety net.
    """
    result = db.execute(text("SELECT nextval('asset_tag_seq')")).scalar()
    return f"AF-{result:04d}"
