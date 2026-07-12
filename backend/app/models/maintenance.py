import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class MaintenancePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MaintenanceStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    technician_assigned = "technician_assigned"
    in_progress = "in_progress"
    resolved = "resolved"


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    raised_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue = Column(Text, nullable=False)
    priority = Column(Enum(MaintenancePriority), default=MaintenancePriority.medium, nullable=False)
    photo_url = Column(Text, nullable=True)
    status = Column(Enum(MaintenanceStatus), default=MaintenanceStatus.pending, nullable=False, index=True)
    technician = Column(String(255), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    asset = relationship("Asset", back_populates="maintenance_requests")
    raiser = relationship("User", foreign_keys=[raised_by])
    approver = relationship("User", foreign_keys=[approved_by])
