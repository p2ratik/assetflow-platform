"""
schemas/allocation.py
"""
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel


class AllocateRequest(BaseModel):
    asset_id: int
    employee_id: int
    department_id: Optional[int] = None
    expected_return_date: Optional[date] = None


class AllocationConflict(BaseModel):
    blocked: bool = True
    held_by: str
    allocation_id: Optional[int] = None
    asset_tag: str
    asset_name: str


class AllocationResponse(BaseModel):
    blocked: bool = False
    id: int
    asset_id: int
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    employee_id: int
    employee_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    allocated_at: Optional[datetime] = None
    expected_return_date: Optional[date] = None
    actual_return_date: Optional[date] = None
    status: str
    checkin_notes: Optional[str] = None

    model_config = {"from_attributes": True}


class ReturnRequest(BaseModel):
    checkin_notes: Optional[str] = None
    condition: Optional[str] = None  # update asset condition on return


class TransferRequestCreate(BaseModel):
    asset_id: int
    target_holder_id: int
    notes: Optional[str] = None


class TransferRejectRequest(BaseModel):
    reason: Optional[str] = None


class TransferRequestResponse(BaseModel):
    id: int
    asset_id: int
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    requested_by_name: Optional[str] = None
    current_holder_name: Optional[str] = None
    target_holder_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    approved_by_name: Optional[str] = None

    model_config = {"from_attributes": True}
