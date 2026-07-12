from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MaintenanceCreate(BaseModel):
    asset_id: int
    issue: str
    priority: str = "medium"
    photo_url: Optional[str] = None


class MaintenanceAssign(BaseModel):
    technician: str


class MaintenanceReject(BaseModel):
    reason: Optional[str] = None


class MaintenanceResponse(BaseModel):
    id: int
    asset_id: int
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    raised_by: int
    raised_by_name: Optional[str] = None
    issue: str
    priority: str
    photo_url: Optional[str] = None
    status: str
    technician: Optional[str] = None
    approved_by: Optional[int] = None
    approved_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
