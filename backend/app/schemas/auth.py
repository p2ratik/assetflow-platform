from typing import Optional
from pydantic import BaseModel, EmailStr


# ── Requests ──────────────────────────────────────────────────
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    department_id: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Responses ─────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int] = None
    status: str

    model_config = {"from_attributes": True}


# Resolve forward reference
TokenResponse.model_rebuild()
