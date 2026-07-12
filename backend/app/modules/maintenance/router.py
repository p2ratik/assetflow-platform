from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.modules.maintenance import service
from app.schemas.maintenance import (
    MaintenanceAssign,
    MaintenanceCreate,
    MaintenanceReject,
    MaintenanceResponse,
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=list[MaintenanceResponse])
def list_maintenance_requests(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return service.list_requests(db, actor, status)


@router.post("", response_model=MaintenanceResponse)
def create_maintenance_request(
    data: MaintenanceCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return service.create_request(db, data, actor)


@router.post("/{request_id}/approve", response_model=MaintenanceResponse)
def approve_maintenance_request(
    request_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return service.approve_request(db, request_id, actor)


@router.post("/{request_id}/reject", response_model=MaintenanceResponse)
def reject_maintenance_request(
    request_id: int,
    data: MaintenanceReject,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return service.reject_request(db, request_id, actor, data.reason)


@router.post("/{request_id}/assign", response_model=MaintenanceResponse)
def assign_maintenance_technician(
    request_id: int,
    data: MaintenanceAssign,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return service.assign_technician(db, request_id, data.technician, actor)


@router.post("/{request_id}/start", response_model=MaintenanceResponse)
def start_maintenance_work(
    request_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return service.start_work(db, request_id, actor)


@router.post("/{request_id}/resolve", response_model=MaintenanceResponse)
def resolve_maintenance_request(
    request_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return service.resolve_request(db, request_id, actor)
