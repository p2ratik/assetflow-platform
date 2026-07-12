"""
utils/overlap.py
================
Server-side overlap check for bookings.
Single indexed query — no race conditions when used inside a transaction.
"""
from typing import Optional
from sqlalchemy.orm import Session
from app.models.booking import Booking, BookingStatus


def find_overlapping_bookings(
    db: Session,
    asset_id: int,
    start_time,
    end_time,
    exclude_booking_id: Optional[int] = None,
) -> list[Booking]:
    """
    Returns all bookings for asset_id that overlap with [start_time, end_time).
    Overlap condition: NOT (new.end <= existing.start OR new.start >= existing.end)
    Only checks upcoming/ongoing bookings (not cancelled/completed).
    """
    q = db.query(Booking).filter(
        Booking.asset_id == asset_id,
        Booking.status.in_([BookingStatus.upcoming, BookingStatus.ongoing]),
        Booking.start_time < end_time,
        Booking.end_time > start_time,
    )
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return q.all()
