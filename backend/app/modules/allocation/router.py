"""
modules/allocation/router.py
=============================
HTTP layer for allocations and transfer requests.
Business logic lives entirely in service.py.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.allocation import (
    AllocateRequest,
    ReturnRequest,
    TransferRequestCreate,
    TransferRejectRequest,
    TransferRequestResponse,
    AllocationResponse,
)
from app.modules.allocation import service

router = APIRouter(prefix="/allocations", tags=["allocations"])
transfer_router = APIRouter(prefix="/transfer-requests", tags=["transfer-requests"])


# ── Allocations ────────────────────────────────────────────────

@router.post("")
def allocate_asset(
    data: AllocateRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager"])),
):
    """
    Allocate asset to employee.
    Returns {blocked: true, held_by: ...} if asset is not Available —
    frontend uses this to offer the Transfer Request CTA inline.
    """
    result = service.allocate_asset(db, data, actor)
    return result


@router.get("", response_model=list[AllocationResponse])
def list_allocations(
    status: Optional[str] = Query(None),
    asset_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Role-scoped list. dept_head sees own dept; employee sees own only."""
    return service.list_allocations(db, actor, status, asset_id)


@router.get("/asset/{asset_id}")
def get_asset_allocation(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Current active allocation for an asset — used to show conflict info."""
    result = service.get_asset_active_allocation(db, asset_id)
    if result is None:
        return {"active": False}
    return {"active": True, **result.model_dump()}


@router.post("/{allocation_id}/return", response_model=AllocationResponse)
def return_asset(
    allocation_id: int,
    data: ReturnRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager"])),
):
    """Return asset: sets allocation→returned, asset→Available."""
    return service.return_asset(db, allocation_id, data, actor)


# ── Transfer Requests ──────────────────────────────────────────

@transfer_router.post("", response_model=TransferRequestResponse, status_code=201)
def create_transfer_request(
    data: TransferRequestCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Any authenticated user can request a transfer for an allocated asset."""
    return service.create_transfer_request(db, data, actor)


@transfer_router.get("", response_model=list[TransferRequestResponse])
def list_transfer_requests(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin", "asset_manager"])),
):
    """Pending/approved/rejected queue — admin & asset_manager only."""
    return service.list_transfer_requests(db, status)


@transfer_router.patch("/{transfer_id}/approve", response_model=TransferRequestResponse)
def approve_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager"])),
):
    """Approve: atomically closes old allocation, creates new one."""
    return service.approve_transfer(db, transfer_id, actor)


@transfer_router.patch("/{transfer_id}/reject", response_model=TransferRequestResponse)
def reject_transfer(
    transfer_id: int,
    data: TransferRejectRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager"])),
):
    return service.reject_transfer(db, transfer_id, data.reason, actor)
