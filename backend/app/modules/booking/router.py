"""
modules/booking/router.py
==========================
HTTP layer for resource booking.
"""
from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingResponse, SlotInfo
from app.modules.booking import service

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("")
def create_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """
    Create a booking. Returns BookingResponse on success,
    or {conflict: true, conflicting_bookings: [...]} on overlap.
    """
    return service.create_booking(db, data, actor)


@router.get("", response_model=list[BookingResponse])
def list_bookings(
    asset_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Own bookings (admin/asset_manager sees all). Optional ?asset_id= filter."""
    return service.list_bookings(db, actor, asset_id)


@router.get("/slots", response_model=list[SlotInfo])
def get_day_slots(
    asset_id: int = Query(...),
    day: date = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Hourly slot view for a single asset on a single day (8AM-8PM)."""
    return service.get_day_slots(db, asset_id, day)


@router.delete("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Cancel a booking. Owner / admin / asset_manager only."""
    return service.cancel_booking(db, booking_id, actor)


@router.get("/bookable-assets")
def list_bookable_assets(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lightweight list of bookable assets for the resource picker dropdown."""
    return service.list_bookable_assets(db)
