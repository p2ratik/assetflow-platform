from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.asset import Asset, AssetStatus
from app.models.maintenance import MaintenancePriority, MaintenanceRequest, MaintenanceStatus
from app.models.user import User
from app.schemas.maintenance import MaintenanceCreate, MaintenanceResponse
from app.utils.activity_logger import log_action
from app.utils.notifier import create_notification


ROUTER_ROLES = {"admin", "asset_manager"}


def _role(user: User) -> str:
    return user.role.value


def _is_router(user: User) -> bool:
    return _role(user) in ROUTER_ROLES


def _response(request: MaintenanceRequest) -> MaintenanceResponse:
    return MaintenanceResponse(
        id=request.id,
        asset_id=request.asset_id,
        asset_tag=request.asset.tag if request.asset else None,
        asset_name=request.asset.name if request.asset else None,
        raised_by=request.raised_by,
        raised_by_name=request.raiser.name if request.raiser else None,
        issue=request.issue,
        priority=request.priority.value,
        photo_url=request.photo_url,
        status=request.status.value,
        technician=request.technician,
        approved_by=request.approved_by,
        approved_by_name=request.approver.name if request.approver else None,
        created_at=request.created_at,
        updated_at=request.updated_at,
    )


def _get_request(db: Session, request_id: int) -> MaintenanceRequest:
    request = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    return request


def _parse_priority(value: str) -> MaintenancePriority:
    try:
        return MaintenancePriority(value)
    except ValueError:
        raise HTTPException(status_code=422, detail="Priority must be low, medium, high, or critical")


def _ensure_router(actor: User) -> None:
    if not _is_router(actor):
        raise HTTPException(status_code=403, detail="Only admin or asset manager can route maintenance")


def _ensure_assigned_or_router(request: MaintenanceRequest, actor: User) -> None:
    if _is_router(actor):
        return
    if request.technician and request.technician.strip().lower() == actor.name.strip().lower():
        return
    raise HTTPException(status_code=403, detail="Only the assigned technician or asset manager can update progress")


def list_requests(
    db: Session,
    actor: User,
    status_filter: Optional[str] = None,
) -> list[MaintenanceResponse]:
    query = db.query(MaintenanceRequest)
    if status_filter:
        try:
            query = query.filter(MaintenanceRequest.status == MaintenanceStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid maintenance status")

    if not _is_router(actor):
        query = query.filter(
            (MaintenanceRequest.raised_by == actor.id)
            | (MaintenanceRequest.technician == actor.name)
        )

    rows = query.order_by(MaintenanceRequest.created_at.desc()).all()
    return [_response(row) for row in rows]


def create_request(db: Session, data: MaintenanceCreate, actor: User) -> MaintenanceResponse:
    asset = db.query(Asset).filter(Asset.id == data.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status in (AssetStatus.retired, AssetStatus.disposed, AssetStatus.lost):
        raise HTTPException(status_code=422, detail=f"Cannot raise maintenance for {asset.status.value} asset")

    request = MaintenanceRequest(
        asset_id=data.asset_id,
        raised_by=actor.id,
        issue=data.issue.strip(),
        priority=_parse_priority(data.priority),
        photo_url=data.photo_url,
        status=MaintenanceStatus.pending,
    )
    if not request.issue:
        raise HTTPException(status_code=422, detail="Issue is required")

    db.add(request)
    db.flush()
    db.refresh(request)
    log_action(db, actor.id, "create_maintenance_request", "maintenance", request.id)
    create_notification(db, actor.id, "maintenance", f"Maintenance request raised for {asset.tag}")
    db.commit()
    db.refresh(request)
    return _response(request)


def approve_request(db: Session, request_id: int, actor: User) -> MaintenanceResponse:
    _ensure_router(actor)
    request = _get_request(db, request_id)
    if request.status != MaintenanceStatus.pending:
        raise HTTPException(status_code=422, detail="Only pending requests can be approved")

    request.status = MaintenanceStatus.approved
    request.approved_by = actor.id
    request.asset.status = AssetStatus.under_maintenance

    log_action(db, actor.id, "approve_maintenance", "maintenance", request.id)
    create_notification(db, request.raised_by, "maintenance", f"Maintenance approved for {request.asset.tag}")
    db.commit()
    db.refresh(request)
    return _response(request)


def reject_request(
    db: Session,
    request_id: int,
    actor: User,
    reason: Optional[str] = None,
) -> MaintenanceResponse:
    _ensure_router(actor)
    request = _get_request(db, request_id)
    if request.status != MaintenanceStatus.pending:
        raise HTTPException(status_code=422, detail="Only pending requests can be rejected")

    request.status = MaintenanceStatus.rejected
    request.approved_by = actor.id

    log_action(db, actor.id, "reject_maintenance", "maintenance", request.id)
    message = f"Maintenance rejected for {request.asset.tag}"
    if reason:
        message = f"{message}: {reason}"
    create_notification(db, request.raised_by, "maintenance", message)
    db.commit()
    db.refresh(request)
    return _response(request)


def assign_technician(
    db: Session,
    request_id: int,
    technician: str,
    actor: User,
) -> MaintenanceResponse:
    _ensure_router(actor)
    request = _get_request(db, request_id)
    if request.status != MaintenanceStatus.approved:
        raise HTTPException(status_code=422, detail="Technician can only be assigned after approval")
    if not technician.strip():
        raise HTTPException(status_code=422, detail="Technician is required")

    request.technician = technician.strip()
    request.status = MaintenanceStatus.technician_assigned

    log_action(db, actor.id, "assign_maintenance_technician", "maintenance", request.id)
    create_notification(db, request.raised_by, "maintenance", f"Technician assigned for {request.asset.tag}")
    db.commit()
    db.refresh(request)
    return _response(request)


def start_work(db: Session, request_id: int, actor: User) -> MaintenanceResponse:
    request = _get_request(db, request_id)
    _ensure_assigned_or_router(request, actor)
    if request.status != MaintenanceStatus.technician_assigned:
        raise HTTPException(status_code=422, detail="Only assigned requests can move to in progress")

    request.status = MaintenanceStatus.in_progress

    log_action(db, actor.id, "start_maintenance", "maintenance", request.id)
    create_notification(db, request.raised_by, "maintenance", f"Maintenance started for {request.asset.tag}")
    db.commit()
    db.refresh(request)
    return _response(request)


def resolve_request(db: Session, request_id: int, actor: User) -> MaintenanceResponse:
    request = _get_request(db, request_id)
    _ensure_assigned_or_router(request, actor)
    if request.status != MaintenanceStatus.in_progress:
        raise HTTPException(status_code=422, detail="Only in-progress requests can be resolved")

    request.status = MaintenanceStatus.resolved
    if request.asset.status == AssetStatus.under_maintenance:
        request.asset.status = AssetStatus.available

    log_action(db, actor.id, "resolve_maintenance", "maintenance", request.id)
    create_notification(db, request.raised_by, "maintenance", f"Maintenance resolved for {request.asset.tag}")
    db.commit()
    db.refresh(request)
    return _response(request)
