"""
modules/dashboard/service.py
=============================
Aggregates KPI data from all modules. All values are live DB queries —
no cached/hardcoded numbers.

Overdue detection: computed live as allocations WHERE expected_return_date < now()
AND actual_return_date IS NULL. Same pattern the plan specifies — no separate table.

Integration pass: maintenance_count and audit_open_count are returned but will
be 0 until Member C wires the maintenance/audit modules. The fields are already
in the response schema so the dashboard UI doesn't need to change.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.asset import Asset, AssetStatus
from app.models.allocation import Allocation, AllocationStatus
from app.models.category import Category
from app.models.department import Department
from app.models.activity_log import ActivityLog
from app.models.user import User


def get_stats(db: Session) -> dict:
    """KPI counts — all live queries."""
    total = db.query(func.count(Asset.id)).scalar() or 0
    available = db.query(func.count(Asset.id)).filter(Asset.status == AssetStatus.available).scalar() or 0
    allocated = db.query(func.count(Asset.id)).filter(Asset.status == AssetStatus.allocated).scalar() or 0
    reserved = db.query(func.count(Asset.id)).filter(Asset.status == AssetStatus.reserved).scalar() or 0
    under_maintenance = db.query(func.count(Asset.id)).filter(Asset.status == AssetStatus.under_maintenance).scalar() or 0
    lost = db.query(func.count(Asset.id)).filter(Asset.status == AssetStatus.lost).scalar() or 0

    # Overdue: live computation — no separate table
    now = datetime.now(timezone.utc)
    overdue_count = db.query(func.count(Allocation.id)).filter(
        Allocation.expected_return_date < now,
        Allocation.actual_return_date.is_(None),
        Allocation.status == AllocationStatus.active,
    ).scalar() or 0

    # Placeholder counts for B & C modules (returns 0 until wired)
    # Member C's maintenance module will update these in integration pass
    try:
        from app.models.maintenance import MaintenanceRequest
        pending_maintenance = db.query(func.count(MaintenanceRequest.id)).filter(
            MaintenanceRequest.status == "pending"
        ).scalar() or 0
    except Exception:
        pending_maintenance = 0

    try:
        from app.models.audit import AuditCycle
        open_audits = db.query(func.count(AuditCycle.id)).filter(
            AuditCycle.status == "open"
        ).scalar() or 0
    except Exception:
        open_audits = 0

    total_departments = db.query(func.count(Department.id)).filter(Department.status == "active").scalar() or 0
    total_categories = db.query(func.count(Category.id)).filter(Category.status == "active").scalar() or 0
    total_users = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0

    return {
        "assets": {
            "total": total,
            "available": available,
            "allocated": allocated,
            "reserved": reserved,
            "under_maintenance": under_maintenance,
            "lost": lost,
        },
        "overdue_count": overdue_count,
        "pending_maintenance": pending_maintenance,
        "open_audits": open_audits,
        "total_departments": total_departments,
        "total_categories": total_categories,
        "total_users": total_users,
    }


def get_overdue_allocations(db: Session, limit: int = 10) -> list[dict]:
    """Return overdue allocations — live query, no separate table needed."""
    now = datetime.now(timezone.utc)
    rows = (
        db.query(Allocation)
        .filter(
            Allocation.expected_return_date < now,
            Allocation.actual_return_date.is_(None),
            Allocation.status == "active",
        )
        .order_by(Allocation.expected_return_date)
        .limit(limit)
        .all()
    )
    result = []
    for a in rows:
        result.append({
            "allocation_id": a.id,
            "asset_id": a.asset_id,
            "asset_tag": a.asset.tag if a.asset else None,
            "asset_name": a.asset.name if a.asset else None,
            "employee_id": a.employee_id,
            "employee_name": a.employee.name if a.employee else None,
            "expected_return_date": a.expected_return_date.isoformat() if a.expected_return_date else None,
            "days_overdue": (now.date() - a.expected_return_date.date()).days if a.expected_return_date else None,
        })
    return result


def get_recent_activity(db: Session, limit: int = 20) -> list[dict]:
    """Return last N activity log entries with resolved user name."""
    logs = (
        db.query(ActivityLog)
        .order_by(ActivityLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user.name if log.user else "System",
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]
