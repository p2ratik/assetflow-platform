"""
schemas/organization.py
========================
Pydantic models for the organization module:
  - Department CRUD
  - Category CRUD (with JSONB custom_fields)
  - Employee management (role elevation, dept assignment)
"""
from typing import Optional, Any
from pydantic import BaseModel


# ── Department ─────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    head_id: Optional[int] = None
    parent_dept_id: Optional[int] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    head_id: Optional[int] = None
    parent_dept_id: Optional[int] = None
    status: Optional[str] = None  # active / inactive


class DepartmentResponse(BaseModel):
    id: int
    name: str
    head_id: Optional[int] = None
    parent_dept_id: Optional[int] = None
    status: str
    head_name: Optional[str] = None  # resolved from head FK

    model_config = {"from_attributes": True}


# ── Category ───────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    custom_fields: Optional[dict[str, Any]] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    custom_fields: Optional[dict[str, Any]] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    custom_fields: Optional[dict[str, Any]] = None
    status: str

    model_config = {"from_attributes": True}


# ── Employee (User management) ─────────────────────────────────

class EmployeeUpdate(BaseModel):
    role: Optional[str] = None           # admin/asset_manager/dept_head/employee
    department_id: Optional[int] = None
    status: Optional[str] = None         # active/inactive


class UserListResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None  # resolved from FK
    status: str

    model_config = {"from_attributes": True}
