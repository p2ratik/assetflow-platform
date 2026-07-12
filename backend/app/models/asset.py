import enum
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Date, Numeric, Boolean, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class AssetStatus(str, enum.Enum):
    available = "Available"
    allocated = "Allocated"
    reserved = "Reserved"
    under_maintenance = "Under Maintenance"
    lost = "Lost"
    retired = "Retired"
    disposed = "Disposed"


class AssetCondition(str, enum.Enum):
    new = "New"
    good = "Good"
    fair = "Fair"
    poor = "Poor"
    damaged = "Damaged"


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    tag = Column(String(20), unique=True, nullable=False, index=True)  # AF-0001
    name = Column(String(255), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    serial_number = Column(String(255), unique=True, nullable=True)
    acquisition_date = Column(Date, nullable=True)
    acquisition_cost = Column(Numeric(12, 2), nullable=True)
    condition = Column(Enum(AssetCondition), default=AssetCondition.new)
    location = Column(String(255), nullable=True)
    status = Column(Enum(AssetStatus), default=AssetStatus.available, nullable=False, index=True)
    is_bookable = Column(Boolean, default=False)
    photo_url = Column(Text, nullable=True)
    qr_code = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    category = relationship("Category")
    allocations = relationship("Allocation", back_populates="asset")
    bookings = relationship("Booking", back_populates="asset")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="asset")
