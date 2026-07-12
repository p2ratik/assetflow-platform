"""
Add GET /api/users — simple user list for dropdowns (any auth).
Separate from /organization/employees which is admin-scoped.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users_for_picker(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Lightweight user list for dropdowns — any authenticated user can call this.
    Returns only id, name, role, department_id for picker use.
    """
    users = db.query(User).filter(User.status == "active").order_by(User.name).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "role": u.role.value,
            "department_id": u.department_id,
        }
        for u in users
    ]
