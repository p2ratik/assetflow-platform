import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Text, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class AllocationStatus(str, enum.Enum):
    active = "active"
    returned = "returned"
    overdue = "overdue"


class Allocation(Base):
    __tablename__ = "allocations"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    allocated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expected_return_date = Column(Date, nullable=True)
    actual_return_date = Column(Date, nullable=True)
    status = Column(Enum(AllocationStatus), default=AllocationStatus.active, nullable=False)
    checkin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    asset = relationship("Asset", back_populates="allocations")
    employee = relationship("User", foreign_keys=[employee_id])
    department = relationship("Department")
