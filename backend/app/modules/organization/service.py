"""
modules/organization/service.py
================================
Pure business logic — no FastAPI/HTTP concerns here.
Each function is directly testable without HTTP.

Enforced rules:
  - Departments: soft-delete only (status=inactive)
  - Categories: soft-delete only (status=inactive) — hard DELETE would cause FK violations
  - Role elevation: Admin-only (enforced in router via require_role)
  - Dept Head scoping: employees query is filtered server-side by user's dept if role=dept_head
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.department import Department
from app.models.category import Category
from app.schemas.organization import (
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    CategoryCreate, CategoryUpdate, CategoryResponse,
    EmployeeUpdate, UserListResponse,
)
from app.utils.activity_logger import log_action


# ── Departments ────────────────────────────────────────────────

def list_departments(db: Session) -> list[DepartmentResponse]:
    """Return all active departments with resolved head name."""
    depts = db.query(Department).filter(Department.status == "active").all()
    result = []
    for d in depts:
        head_name = d.head.name if d.head else None
        resp = DepartmentResponse(
            id=d.id,
            name=d.name,
            head_id=d.head_id,
            parent_dept_id=d.parent_dept_id,
            status=d.status,
            head_name=head_name,
        )
        result.append(resp)
    return result


def create_department(db: Session, data: DepartmentCreate, actor_id: int) -> DepartmentResponse:
    existing = db.query(Department).filter(Department.name == data.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")

    if data.head_id:
        head = db.query(User).filter(User.id == data.head_id).first()
        if not head:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Head user not found")

    dept = Department(name=data.name, head_id=data.head_id, parent_dept_id=data.parent_dept_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    log_action(db, actor_id, "create_department", "department", dept.id)
    head_name = dept.head.name if dept.head else None
    return DepartmentResponse(
        id=dept.id, name=dept.name, head_id=dept.head_id,
        parent_dept_id=dept.parent_dept_id, status=dept.status, head_name=head_name,
    )


def update_department(db: Session, dept_id: int, data: DepartmentUpdate, actor_id: int) -> DepartmentResponse:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    if data.name is not None:
        conflict = db.query(Department).filter(Department.name == data.name, Department.id != dept_id).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
        dept.name = data.name
    if data.head_id is not None:
        head = db.query(User).filter(User.id == data.head_id).first()
        if not head:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Head user not found")
        dept.head_id = data.head_id
    if data.parent_dept_id is not None:
        dept.parent_dept_id = data.parent_dept_id
    if data.status is not None:
        dept.status = data.status

    db.commit()
    db.refresh(dept)
    log_action(db, actor_id, "update_department", "department", dept.id)
    head_name = dept.head.name if dept.head else None
    return DepartmentResponse(
        id=dept.id, name=dept.name, head_id=dept.head_id,
        parent_dept_id=dept.parent_dept_id, status=dept.status, head_name=head_name,
    )


def deactivate_department(db: Session, dept_id: int, actor_id: int) -> dict:
    """Soft-delete: set status=inactive. Never hard-deletes to preserve FK integrity."""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    dept.status = "inactive"
    db.commit()
    log_action(db, actor_id, "deactivate_department", "department", dept_id)
    return {"detail": f"Department '{dept.name}' deactivated"}


# ── Categories ─────────────────────────────────────────────────

def list_categories(db: Session, include_inactive: bool = False) -> list[CategoryResponse]:
    q = db.query(Category)
    if not include_inactive:
        q = q.filter(Category.status == "active")
    return [CategoryResponse.model_validate(c) for c in q.all()]


def create_category(db: Session, data: CategoryCreate, actor_id: int) -> CategoryResponse:
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
    cat = Category(name=data.name, custom_fields=data.custom_fields or {}, status="active")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    log_action(db, actor_id, "create_category", "category", cat.id)
    return CategoryResponse.model_validate(cat)


def update_category(db: Session, cat_id: int, data: CategoryUpdate, actor_id: int) -> CategoryResponse:
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if data.name is not None:
        conflict = db.query(Category).filter(Category.name == data.name, Category.id != cat_id).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
        cat.name = data.name
    if data.custom_fields is not None:
        cat.custom_fields = data.custom_fields
    db.commit()
    db.refresh(cat)
    log_action(db, actor_id, "update_category", "category", cat.id)
    return CategoryResponse.model_validate(cat)


def deactivate_category(db: Session, cat_id: int, actor_id: int) -> dict:
    """Soft-delete: set status=inactive.
    Hard DELETE is intentionally absent — FK violation risk from assets.category_id.
    """
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    cat.status = "inactive"
    db.commit()
    log_action(db, actor_id, "deactivate_category", "category", cat_id)
    return {"detail": f"Category '{cat.name}' deactivated"}


# ── Employees ──────────────────────────────────────────────────

def list_employees(
    db: Session,
    actor: User,
    department_id: int | None = None,
) -> list[UserListResponse]:
    """
    Role-scoped employee list:
    - admin/asset_manager: see all users, optional ?department_id= filter
    - dept_head: can ONLY query their own department (server enforces — not just hidden UI)
    """
    q = db.query(User)

    if actor.role.value == "dept_head":
        # Dept heads can only see their own department's members
        if department_id and department_id != actor.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department heads can only view their own department",
            )
        q = q.filter(User.department_id == actor.department_id)
    elif department_id:
        q = q.filter(User.department_id == department_id)

    users = q.order_by(User.name).all()
    result = []
    for u in users:
        dept_name = u.department.name if u.department else None
        result.append(UserListResponse(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role.value,
            department_id=u.department_id,
            department_name=dept_name,
            status=u.status,
        ))
    return result


def update_employee(db: Session, employee_id: int, data: EmployeeUpdate, actor: User) -> UserListResponse:
    """
    Update employee role/dept/status.
    Role elevation is Admin-only (caller must pass require_role(["admin"]) in router).
    """
    user = db.query(User).filter(User.id == employee_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.role is not None:
        # Validate role value
        valid_roles = [r.value for r in UserRole]
        if data.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid role. Must be one of: {valid_roles}",
            )
        user.role = UserRole(data.role)

    if data.department_id is not None:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        user.department_id = data.department_id

    if data.status is not None:
        user.status = data.status

    db.commit()
    db.refresh(user)
    log_action(db, actor.id, "update_employee", "user", user.id)
    dept_name = user.department.name if user.department else None
    return UserListResponse(
        id=user.id, name=user.name, email=user.email,
        role=user.role.value, department_id=user.department_id,
        department_name=dept_name, status=user.status,
    )
