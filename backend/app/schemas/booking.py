"""
schemas/booking.py
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class BookingCreate(BaseModel):
    asset_id: int
    start_time: datetime
    end_time: datetime


class BookingResponse(BaseModel):
    id: int
    asset_id: int
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    booked_by: int
    booked_by_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BookingConflict(BaseModel):
    conflict: bool = True
    message: str
    conflicting_bookings: list[BookingResponse] = []


class SlotInfo(BaseModel):
    hour: int
    is_booked: bool
    booking: Optional[BookingResponse] = None
