"""
modules/assets/service.py
==========================
Business logic for asset registration, lookup, and updates.

Key design decisions:
  - Tag generation: uses Postgres SEQUENCE via nextval() — atomic, race-safe
  - QR code: generated locally via qrcode lib, stored as base64 PNG data URI
  - Photo upload: conditional on Cloudinary config — skipped gracefully if absent
  - Status transitions: only Retired/Disposed can be set manually here;
    other transitions (Available→Allocated, →Reserved, →Under Maintenance)
    happen inside their respective module services
  - activity_log entry on every mutation
"""
import base64
import io
from math import ceil
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.asset import Asset, AssetStatus, AssetCondition
from app.models.category import Category
from app.schemas.assets import AssetCreate, AssetUpdate, AssetResponse, AssetListResponse
from app.utils.tag_generator import generate_tag
from app.utils.activity_logger import log_action


# ── Status transitions allowed via direct update ───────────────
MANUALLY_SETTABLE_STATUSES = {AssetStatus.retired, AssetStatus.disposed}


def _make_qr_data_uri(tag: str, asset_id: int) -> str:
    """Generate a QR code for the asset tag and return it as a base64 PNG data URI."""
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(f"assetflow://asset/{asset_id}?tag={tag}")
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"
    except Exception:
        return ""


def _to_response(asset: Asset) -> AssetResponse:
    """Convert ORM model to response schema with resolved category name."""
    return AssetResponse(
        id=asset.id,
        tag=asset.tag,
        name=asset.name,
        category_id=asset.category_id,
        category_name=asset.category.name if asset.category else None,
        serial_number=asset.serial_number,
        acquisition_date=asset.acquisition_date,
        acquisition_cost=asset.acquisition_cost,
        condition=asset.condition.value if asset.condition else None,
        location=asset.location,
        status=asset.status.value if asset.status else None,
        is_bookable=asset.is_bookable,
        photo_url=asset.photo_url,
        qr_code=asset.qr_code,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


# ── Registration ───────────────────────────────────────────────

def register_asset(db: Session, data: AssetCreate, actor_id: int) -> AssetResponse:
    """Register a new asset. Generates tag via Postgres sequence and QR code locally."""
    # Validate category exists and is active
    cat = db.query(Category).filter(
        Category.id == data.category_id,
        Category.status == "active",
    ).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found or inactive")

    # Validate serial uniqueness
    if data.serial_number:
        dup = db.query(Asset).filter(Asset.serial_number == data.serial_number).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Serial number already registered on asset {dup.tag}",
            )

    # Validate condition enum
    try:
        condition = AssetCondition(data.condition) if data.condition else AssetCondition.new
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid condition: {data.condition}")

    # Generate tag atomically via DB sequence
    tag = generate_tag(db)

    asset = Asset(
        tag=tag,
        name=data.name,
        category_id=data.category_id,
        serial_number=data.serial_number,
        acquisition_date=data.acquisition_date,
        acquisition_cost=data.acquisition_cost,
        condition=condition,
        location=data.location,
        status=AssetStatus.available,
        is_bookable=data.is_bookable,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    # Generate QR code after we have the DB id
    asset.qr_code = _make_qr_data_uri(tag, asset.id)
    db.commit()
    db.refresh(asset)

    log_action(db, actor_id, "register_asset", "asset", asset.id)
    return _to_response(asset)


# ── Listing ────────────────────────────────────────────────────

def list_assets(
    db: Session,
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    department_id: Optional[int] = None,  # future: filter by allocation dept
    is_bookable: Optional[bool] = None,
    page: int = 1,
    per_page: int = 20,
) -> AssetListResponse:
    """Paginated asset list with optional filters."""
    query = db.query(Asset)

    if q:
        like = f"%{q}%"
        query = query.filter(
            Asset.tag.ilike(like) |
            Asset.name.ilike(like) |
            Asset.serial_number.ilike(like) |
            Asset.location.ilike(like)
        )
    if category_id:
        query = query.filter(Asset.category_id == category_id)
    if status_filter:
        try:
            s = AssetStatus(status_filter)
            query = query.filter(Asset.status == s)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid status filter: {status_filter}")
    if is_bookable is not None:
        query = query.filter(Asset.is_bookable == is_bookable)

    total = query.count()
    offset = (page - 1) * per_page
    assets = query.order_by(Asset.tag).offset(offset).limit(per_page).all()

    return AssetListResponse(
        items=[_to_response(a) for a in assets],
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total else 0,
    )


# ── Single asset ───────────────────────────────────────────────

def get_asset(db: Session, asset_id: int) -> AssetResponse:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return _to_response(asset)


# ── Update ─────────────────────────────────────────────────────

def update_asset(db: Session, asset_id: int, data: AssetUpdate, actor_id: int) -> AssetResponse:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if data.name is not None:
        asset.name = data.name
    if data.category_id is not None:
        cat = db.query(Category).filter(Category.id == data.category_id, Category.status == "active").first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found or inactive")
        asset.category_id = data.category_id
    if data.serial_number is not None:
        dup = db.query(Asset).filter(Asset.serial_number == data.serial_number, Asset.id != asset_id).first()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial already in use by {dup.tag}")
        asset.serial_number = data.serial_number
    if data.acquisition_date is not None:
        asset.acquisition_date = data.acquisition_date
    if data.acquisition_cost is not None:
        asset.acquisition_cost = data.acquisition_cost
    if data.condition is not None:
        try:
            asset.condition = AssetCondition(data.condition)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid condition: {data.condition}")
    if data.location is not None:
        asset.location = data.location
    if data.is_bookable is not None:
        asset.is_bookable = data.is_bookable
    if data.status is not None:
        try:
            new_status = AssetStatus(data.status)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid status: {data.status}")
        if new_status not in MANUALLY_SETTABLE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Status '{data.status}' cannot be set manually. Only Retired/Disposed are manual transitions.",
            )
        asset.status = new_status

    db.commit()
    db.refresh(asset)
    log_action(db, actor_id, "update_asset", "asset", asset.id)
    return _to_response(asset)


# ── Photo upload ───────────────────────────────────────────────

async def upload_asset_photo(db: Session, asset_id: int, file: UploadFile, actor_id: int) -> AssetResponse:
    """Upload asset photo to Cloudinary if configured, else raise informative error."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if not settings.cloudinary_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Photo upload not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env",
        )

    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )

    content = await file.read()
    result = cloudinary.uploader.upload(
        content,
        folder="assetflow/assets",
        public_id=f"asset_{asset_id}_{asset.tag}",
        overwrite=True,
    )
    asset.photo_url = result["secure_url"]
    db.commit()
    db.refresh(asset)
    log_action(db, actor_id, "upload_asset_photo", "asset", asset.id)
    return _to_response(asset)
