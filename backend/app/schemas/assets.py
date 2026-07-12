"""
schemas/assets.py
=================
Pydantic models for the assets module:
  - Asset registration, update, listing
  - Includes category name for display (no extra join needed on frontend)
"""
from typing import Optional, Any
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel


class AssetCreate(BaseModel):
    name: str
    category_id: int
    serial_number: Optional[str] = None
    acquisition_date: Optional[date] = None
    acquisition_cost: Optional[Decimal] = None
    condition: Optional[str] = "New"        # New/Good/Fair/Poor/Damaged
    location: Optional[str] = None
    is_bookable: bool = False


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    serial_number: Optional[str] = None
    acquisition_date: Optional[date] = None
    acquisition_cost: Optional[Decimal] = None
    condition: Optional[str] = None
    location: Optional[str] = None
    is_bookable: Optional[bool] = None
    # Only Retired / Disposed can be set manually here.
    # Other status transitions happen via their respective module endpoints.
    status: Optional[str] = None


class AssetResponse(BaseModel):
    id: int
    tag: str
    name: str
    category_id: int
    category_name: Optional[str] = None  # resolved
    serial_number: Optional[str] = None
    acquisition_date: Optional[date] = None
    acquisition_cost: Optional[Decimal] = None
    condition: str
    location: Optional[str] = None
    status: str
    is_bookable: bool
    photo_url: Optional[str] = None
    qr_code: Optional[str] = None        # base64 PNG data URI
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    items: list[AssetResponse]
    total: int
    page: int
    per_page: int
    pages: int
