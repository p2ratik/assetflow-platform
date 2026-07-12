from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, UserResponse
from app.modules.auth import service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    """Register a new employee account. Role is always 'employee' — admin elevates later."""
    return service.signup(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and receive a JWT."""
    return service.authenticate(db, data)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.get("/setup/status")
def setup_status(db: Session = Depends(get_db)):
    """
    Returns whether the platform needs first-run setup.
    Frontend uses this to show/hide the 'Create Admin' option.
    """
    admin_exists = db.query(User).filter(User.role == UserRole.admin).first() is not None
    return {"needs_setup": not admin_exists, "admin_exists": admin_exists}


@router.post("/setup", response_model=TokenResponse, status_code=201)
def bootstrap_admin(data: SignupRequest, db: Session = Depends(get_db)):
    """
    First-run only: create the initial admin account.
    Returns 409 if any admin already exists — prevents privilege escalation.
    """
    return service.bootstrap_admin(db, data)
