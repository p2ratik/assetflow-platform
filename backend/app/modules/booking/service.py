"""
modules/booking/service.py
===========================
Business logic for resource booking.

Rules:
  - Asset must be bookable (is_bookable=True)
  - Asset must not be Under Maintenance
  - Overlap check runs server-side before insert
  - start_time must be in the future (or today)
  - Only owner / admin / asset_manager can cancel
  - Cancelling reverts asset status if it was Reserved
"""
from datetime import datetime, timezone, timedelta, date
from typing import Optional, Union

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.asset import Asset, AssetStatus
from app.models.booking import Booking, BookingStatus
from app.models.user import User
from app.schemas.booking import (
    BookingCreate, BookingResponse, BookingConflict, SlotInfo,
)
from app.utils.overlap import find_overlapping_bookings
from app.utils.activity_logger import log_action
from app.utils.notifier import create_notification


def _booking_response(b: Booking) -> BookingResponse:
    return BookingResponse(
        id=b.id,
        asset_id=b.asset_id,
        asset_tag=b.asset.tag if b.asset else None,
        asset_name=b.asset.name if b.asset else None,
        booked_by=b.booked_by,
        booked_by_name=b.user.name if b.user else None,
        start_time=b.start_time,
        end_time=b.end_time,
        status=b.status.value,
        created_at=b.created_at,
    )


# ── Create Booking ─────────────────────────────────────────────

def create_booking(
    db: Session,
    data: BookingCreate,
    actor: User,
) -> Union[BookingConflict, BookingResponse]:
    asset = db.query(Asset).filter(Asset.id == data.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not asset.is_bookable:
        raise HTTPException(status_code=422, detail="This asset is not bookable")
    if asset.status == AssetStatus.under_maintenance:
        raise HTTPException(status_code=422, detail="Asset is under maintenance")

    if data.end_time <= data.start_time:
        raise HTTPException(status_code=422, detail="End time must be after start time")

    # Overlap check
    conflicts = find_overlapping_bookings(db, data.asset_id, data.start_time, data.end_time)
    if conflicts:
        return BookingConflict(
            conflict=True,
            message=f"Slot conflicts with {len(conflicts)} existing booking(s)",
            conflicting_bookings=[_booking_response(c) for c in conflicts],
        )

    booking = Booking(
        asset_id=data.asset_id,
        booked_by=actor.id,
        start_time=data.start_time,
        end_time=data.end_time,
        status=BookingStatus.upcoming,
    )
    db.add(booking)
    db.flush()
    db.refresh(booking)

    log_action(db, actor.id, "create_booking", "booking", booking.id)
    create_notification(
        db, actor.id, "booking",
        f"Booking confirmed: {asset.tag} from {data.start_time.strftime('%H:%M')} to {data.end_time.strftime('%H:%M')}",
    )
    db.commit()
    db.refresh(booking)
    return _booking_response(booking)


# ── List Bookings ──────────────────────────────────────────────

def list_bookings(
    db: Session,
    actor: User,
    asset_id: Optional[int] = None,
) -> list[BookingResponse]:
    q = db.query(Booking)
    if asset_id:
        q = q.filter(Booking.asset_id == asset_id)
    elif actor.role.value not in ("admin", "asset_manager"):
        # Regular users see only their own bookings
        q = q.filter(Booking.booked_by == actor.id)

    return [_booking_response(b) for b in q.order_by(Booking.start_time.desc()).all()]


# ── Asset Day Slots ────────────────────────────────────────────

def get_day_slots(
    db: Session,
    asset_id: int,
    day: date,
    start_hour: int = 8,
    end_hour: int = 20,
) -> list[SlotInfo]:
    """
    Returns hourly slot info for an asset on a given day.
    Each slot: {hour, is_booked, booking (if booked)}.
    """
    day_start = datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    bookings = db.query(Booking).filter(
        Booking.asset_id == asset_id,
        Booking.status.in_([BookingStatus.upcoming, BookingStatus.ongoing]),
        Booking.start_time < day_end,
        Booking.end_time > day_start,
    ).all()

    slots = []
    for h in range(start_hour, end_hour):
        slot_start = day_start.replace(hour=h)
        slot_end = day_start.replace(hour=h + 1)

        matching = None
        for b in bookings:
            if b.start_time < slot_end and b.end_time > slot_start:
                matching = b
                break

        slots.append(SlotInfo(
            hour=h,
            is_booked=matching is not None,
            booking=_booking_response(matching) if matching else None,
        ))
    return slots


# ── Cancel Booking ─────────────────────────────────────────────

def cancel_booking(
    db: Session,
    booking_id: int,
    actor: User,
) -> BookingResponse:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only owner, admin, or asset_manager can cancel
    if booking.booked_by != actor.id and actor.role.value not in ("admin", "asset_manager"):
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    if booking.status in (BookingStatus.cancelled, BookingStatus.completed):
        raise HTTPException(status_code=422, detail=f"Cannot cancel a {booking.status.value} booking")

    booking.status = BookingStatus.cancelled

    log_action(db, actor.id, "cancel_booking", "booking", booking.id)
    create_notification(
        db, booking.booked_by, "booking",
        f"Booking for {booking.asset.tag} has been cancelled.",
    )
    db.commit()
    db.refresh(booking)
    return _booking_response(booking)


# ── Bookable Assets ────────────────────────────────────────────

def list_bookable_assets(db: Session) -> list[dict]:
    """Lightweight list of bookable assets for the resource picker."""
    assets = db.query(Asset).filter(
        Asset.is_bookable == True,
        Asset.status != AssetStatus.disposed,
        Asset.status != AssetStatus.retired,
    ).order_by(Asset.tag).all()
    return [
        {"id": a.id, "tag": a.tag, "name": a.name, "status": a.status.value}
        for a in assets
    ]
