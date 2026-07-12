"""
modules/organization/router.py
================================
HTTP layer only — request/response + auth guards.
All business logic lives in service.py.

Role guards:
  - GET departments/categories: any authenticated user
  - POST/PUT/PATCH departments/categories: admin only
  - GET employees: admin, asset_manager, dept_head (scoped)
  - PUT employees: admin only (role elevation is Admin-exclusive)
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.organization import (
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    CategoryCreate, CategoryUpdate, CategoryResponse,
    EmployeeUpdate, UserListResponse,
)
from app.modules.organization import service

router = APIRouter(prefix="/organization", tags=["organization"])


# ── Departments ────────────────────────────────────────────────

@router.get("/departments", response_model=list[DepartmentResponse])
def get_departments(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),  # any authenticated user
):
    """List all active departments."""
    return service.list_departments(db)


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin"])),
):
    """Create a new department. Admin only."""
    return service.create_department(db, data, actor.id)


@router.put("/departments/{dept_id}", response_model=DepartmentResponse)
def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin"])),
):
    """Update department name, head, or status. Admin only."""
    return service.update_department(db, dept_id, data, actor.id)


@router.patch("/departments/{dept_id}/deactivate")
def deactivate_department(
    dept_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin"])),
):
    """Soft-delete a department (set status=inactive). Admin only.
    Never hard-deletes — FK integrity with users and allocations is preserved."""
    return service.deactivate_department(db, dept_id, actor.id)


# ── Categories ─────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
def get_categories(
    include_inactive: bool = Query(False, description="Include deactivated categories"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List categories. Any authenticated user. Admins can include inactive."""
    return service.list_categories(db, include_inactive)


@router.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin"])),
):
    """Create a new asset category. Admin only."""
    return service.create_category(db, data, actor.id)


@router.put("/categories/{cat_id}", response_model=CategoryResponse)
def update_category(
    cat_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin"])),
):
    """Update category name or custom_fields. Admin only."""
    return service.update_category(db, cat_id, data, actor.id)


@router.patch("/categories/{cat_id}/deactivate")
def deactivate_category(
    cat_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin"])),
):
    """Soft-delete a category. Admin only.
    Hard DELETE is intentionally absent — assets reference categories via FK."""
    return service.deactivate_category(db, cat_id, actor.id)


# ── Employees ──────────────────────────────────────────────────

@router.get("/employees", response_model=list[UserListResponse])
def get_employees(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager", "dept_head"])),
):
    """
    List users.
    - admin/asset_manager: all users, optional ?department_id= filter
    - dept_head: only their own department (server enforces — not just a hidden UI button)
    """
    return service.list_employees(db, actor, department_id)


@router.put("/employees/{employee_id}", response_model=UserListResponse)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin"])),
):
    """Update employee role, department, or status. Admin only.
    Role elevation to asset_manager/dept_head/admin is ONLY here — not in signup."""
    return service.update_employee(db, employee_id, data, actor)
