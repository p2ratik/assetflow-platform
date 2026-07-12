"""
modules/dashboard/router.py
============================
Dashboard endpoints — all authenticated users can read these.
Data reflects their org's real state from all modules.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.modules.dashboard import service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """KPI aggregates: asset counts by status, overdue count, pending maintenance, open audits."""
    return service.get_stats(db)


@router.get("/overdue")
def get_overdue(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Live overdue allocation list — computed in real time, no separate table."""
    return service.get_overdue_allocations(db, limit)


@router.get("/activity")
def get_activity(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Recent activity feed from activity_log table."""
    return service.get_recent_activity(db, limit)
