"""
modules/allocation/service.py
==============================
All business logic for allocations and transfer requests.
No FastAPI imports — pure SQLAlchemy + domain logic, fully testable.

Business rules enforced here (not just in the UI):
  - Allocate: asset must be Available; returns conflict payload if taken
  - Return: records actual_return_date + condition; sets asset → Available
  - Transfer: only for Allocated assets; auto-fills current_holder from active allocation
  - Approve transfer: atomic close-old + create-new (no status gap on asset)
  - Reject transfer: records reason, notifies requester
"""
from datetime import datetime, timezone
from typing import Optional, Union

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.asset import Asset, AssetStatus, AssetCondition
from app.models.allocation import Allocation, AllocationStatus
from app.models.transfer_request import TransferRequest, TransferStatus
from app.models.user import User, UserRole
from app.schemas.allocation import (
    AllocateRequest, AllocationResponse, AllocationConflict,
    ReturnRequest, TransferRequestCreate, TransferRequestResponse,
)
from app.utils.activity_logger import log_action
from app.utils.notifier import create_notification


# ── Helpers ────────────────────────────────────────────────────

def _alloc_response(a: Allocation) -> AllocationResponse:
    return AllocationResponse(
        blocked=False,
        id=a.id,
        asset_id=a.asset_id,
        asset_tag=a.asset.tag if a.asset else None,
        asset_name=a.asset.name if a.asset else None,
        employee_id=a.employee_id,
        employee_name=a.employee.name if a.employee else None,
        department_id=a.department_id,
        department_name=a.department.name if a.department else None,
        allocated_at=a.allocated_at,
        expected_return_date=a.expected_return_date,
        actual_return_date=a.actual_return_date,
        status=a.status.value,
        checkin_notes=a.checkin_notes,
    )


def _transfer_response(t: TransferRequest) -> TransferRequestResponse:
    return TransferRequestResponse(
        id=t.id,
        asset_id=t.asset_id,
        asset_tag=t.asset.tag if t.asset else None,
        asset_name=t.asset.name if t.asset else None,
        requested_by_name=t.requester.name if t.requester else None,
        current_holder_name=t.holder.name if t.holder else None,
        target_holder_name=t.target.name if t.target else None,
        status=t.status.value,
        notes=t.notes,
        created_at=t.created_at,
        approved_by_name=t.approver.name if t.approver else None,
    )


# ── Allocation ─────────────────────────────────────────────────

def allocate_asset(
    db: Session,
    data: AllocateRequest,
    actor: User,
) -> Union[AllocationConflict, AllocationResponse]:
    """
    Allocate asset to employee.
    Returns AllocationConflict (blocked=True) if asset is not Available —
    caller checks .blocked to decide whether to show the transfer CTA.
    """
    asset = db.query(Asset).filter(Asset.id == data.asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    employee = db.query(User).filter(User.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if asset.status != AssetStatus.available:
        active = db.query(Allocation).filter(
            Allocation.asset_id == asset.id,
            Allocation.status == AllocationStatus.active,
        ).first()
        return AllocationConflict(
            blocked=True,
            held_by=active.employee.name if (active and active.employee) else "Unknown",
            allocation_id=active.id if active else None,
            asset_tag=asset.tag,
            asset_name=asset.name,
        )

    alloc = Allocation(
        asset_id=data.asset_id,
        employee_id=data.employee_id,
        department_id=data.department_id,
        expected_return_date=data.expected_return_date,
        status=AllocationStatus.active,
    )
    db.add(alloc)
    asset.status = AssetStatus.allocated
    db.flush()
    db.refresh(alloc)

    log_action(db, actor.id, "allocate_asset", "allocation", alloc.id)
    create_notification(
        db, data.employee_id, "allocation",
        f"Asset {asset.tag} ({asset.name}) has been allocated to you by {actor.name}.",
    )
    db.commit()
    db.refresh(alloc)
    return _alloc_response(alloc)


def list_allocations(
    db: Session,
    actor: User,
    status_filter: Optional[str] = None,
    asset_id: Optional[int] = None,
) -> list[AllocationResponse]:
    q = db.query(Allocation)

    # Role scoping
    if actor.role.value == "dept_head":
        q = q.filter(Allocation.department_id == actor.department_id)
    elif actor.role.value == "employee":
        q = q.filter(Allocation.employee_id == actor.id)

    if status_filter:
        try:
            q = q.filter(Allocation.status == AllocationStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status_filter}")

    if asset_id:
        q = q.filter(Allocation.asset_id == asset_id)

    return [_alloc_response(a) for a in q.order_by(Allocation.allocated_at.desc()).all()]


def get_asset_active_allocation(db: Session, asset_id: int) -> Optional[AllocationResponse]:
    a = db.query(Allocation).filter(
        Allocation.asset_id == asset_id,
        Allocation.status == AllocationStatus.active,
    ).first()
    return _alloc_response(a) if a else None


def return_asset(
    db: Session,
    allocation_id: int,
    data: ReturnRequest,
    actor: User,
) -> AllocationResponse:
    alloc = db.query(Allocation).filter(
        Allocation.id == allocation_id,
        Allocation.status == AllocationStatus.active,
    ).first()
    if not alloc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active allocation not found")

    asset = alloc.asset
    alloc.actual_return_date = datetime.now(timezone.utc).date()
    alloc.checkin_notes = data.checkin_notes
    alloc.status = AllocationStatus.returned
    asset.status = AssetStatus.available

    if data.condition:
        try:
            asset.condition = AssetCondition(data.condition)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid condition: {data.condition}")

    log_action(db, actor.id, "return_asset", "allocation", alloc.id)
    create_notification(
        db, alloc.employee_id, "return",
        f"Asset {asset.tag} ({asset.name}) has been checked in successfully.",
    )
    db.commit()
    db.refresh(alloc)
    return _alloc_response(alloc)


# ── Transfer Requests ──────────────────────────────────────────

def create_transfer_request(
    db: Session,
    data: TransferRequestCreate,
    actor: User,
) -> TransferRequestResponse:
    asset = db.query(Asset).filter(Asset.id == data.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.status != AssetStatus.allocated:
        raise HTTPException(
            status_code=422,
            detail="Transfer requests are only for currently Allocated assets.",
        )

    active_alloc = db.query(Allocation).filter(
        Allocation.asset_id == asset.id,
        Allocation.status == AllocationStatus.active,
    ).first()
    if not active_alloc:
        raise HTTPException(status_code=422, detail="No active allocation found for this asset")

    target = db.query(User).filter(User.id == data.target_holder_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target employee not found")

    # Block duplicate pending request
    dupe = db.query(TransferRequest).filter(
        TransferRequest.asset_id == data.asset_id,
        TransferRequest.status == TransferStatus.requested,
    ).first()
    if dupe:
        raise HTTPException(status_code=409, detail="A pending transfer request already exists for this asset")

    tr = TransferRequest(
        asset_id=data.asset_id,
        requested_by=actor.id,
        current_holder=active_alloc.employee_id,
        target_holder=data.target_holder_id,
        notes=data.notes,
        status=TransferStatus.requested,
    )
    db.add(tr)
    db.flush()

    log_action(db, actor.id, "create_transfer_request", "transfer_request", tr.id)

    # Notify all admins/asset_managers
    managers = db.query(User).filter(
        User.role.in_([UserRole.admin, UserRole.asset_manager]),
        User.status == "active",
    ).all()
    for mgr in managers:
        create_notification(
            db, mgr.id, "transfer",
            f"Transfer request: {asset.tag} from {active_alloc.employee.name} → {target.name}",
        )

    db.commit()
    db.refresh(tr)
    return _transfer_response(tr)


def list_transfer_requests(
    db: Session,
    status_filter: Optional[str] = None,
) -> list[TransferRequestResponse]:
    q = db.query(TransferRequest)
    if status_filter:
        try:
            q = q.filter(TransferRequest.status == TransferStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status_filter}")
    return [_transfer_response(t) for t in q.order_by(TransferRequest.created_at.desc()).all()]


def approve_transfer(db: Session, transfer_id: int, actor: User) -> TransferRequestResponse:
    tr = db.query(TransferRequest).filter(
        TransferRequest.id == transfer_id,
        TransferRequest.status == TransferStatus.requested,
    ).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Pending transfer request not found")

    # Close old allocation
    old = db.query(Allocation).filter(
        Allocation.asset_id == tr.asset_id,
        Allocation.status == AllocationStatus.active,
    ).first()
    if old:
        old.status = AllocationStatus.returned
        old.actual_return_date = datetime.now(timezone.utc).date()

    # Create new allocation — asset stays Allocated, no status gap
    new_alloc = Allocation(
        asset_id=tr.asset_id,
        employee_id=tr.target_holder,
        status=AllocationStatus.active,
    )
    db.add(new_alloc)

    tr.status = TransferStatus.approved
    tr.approved_by = actor.id
    db.flush()

    log_action(db, actor.id, "approve_transfer", "transfer_request", tr.id)
    create_notification(db, tr.current_holder, "transfer",
                        f"Transfer of {tr.asset.tag} has been approved.")
    create_notification(db, tr.target_holder, "transfer",
                        f"Asset {tr.asset.tag} has been transferred to you.")
    db.commit()
    db.refresh(tr)
    return _transfer_response(tr)


def reject_transfer(
    db: Session,
    transfer_id: int,
    reason: Optional[str],
    actor: User,
) -> TransferRequestResponse:
    tr = db.query(TransferRequest).filter(
        TransferRequest.id == transfer_id,
        TransferRequest.status == TransferStatus.requested,
    ).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Pending transfer request not found")

    tr.status = TransferStatus.rejected
    tr.approved_by = actor.id
    if reason:
        tr.notes = (tr.notes or "") + f"\n[Rejected: {reason}]"

    log_action(db, actor.id, "reject_transfer", "transfer_request", tr.id)
    create_notification(db, tr.requested_by, "transfer",
                        f"Transfer request for {tr.asset.tag} was rejected.")
    db.commit()
    db.refresh(tr)
    return _transfer_response(tr)
