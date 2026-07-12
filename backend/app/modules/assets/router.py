"""
modules/assets/router.py
=========================
HTTP layer: request/response + auth guards only.
All logic in service.py.

Role guards:
  - GET /assets, GET /assets/{id}: any authenticated user
  - POST /assets, PUT /assets/{id}: asset_manager, admin
  - POST /assets/{id}/photo: asset_manager, admin
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.assets import AssetCreate, AssetUpdate, AssetResponse, AssetListResponse
from app.modules.assets import service

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=AssetListResponse)
def list_assets(
    q: Optional[str] = Query(None, description="Search tag, name, serial, or location"),
    category_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="Filter by status value e.g. Available"),
    department_id: Optional[int] = Query(None, description="Filter by holding department"),
    is_bookable: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List assets with optional filters and pagination. Any authenticated user."""
    return service.list_assets(db, q, category_id, status, department_id, is_bookable, page, per_page)


@router.post("", response_model=AssetResponse, status_code=201)
def register_asset(
    data: AssetCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager"])),
):
    """Register a new asset. Generates AF-XXXX tag + QR code automatically."""
    return service.register_asset(db, data, actor.id)


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get full asset detail. Any authenticated user."""
    return service.get_asset(db, asset_id)


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager"])),
):
    """Update asset metadata. Only Retired/Disposed status settable here; others via module endpoints."""
    return service.update_asset(db, asset_id, data, actor.id)


@router.post("/{asset_id}/photo", response_model=AssetResponse)
async def upload_photo(
    asset_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(["admin", "asset_manager"])),
):
    """Upload asset photo. Requires CLOUDINARY_* env vars to be configured."""
    return await service.upload_asset_photo(db, asset_id, file, actor.id)
