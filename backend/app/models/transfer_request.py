import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, Enum, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class TransferStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"


class TransferRequest(Base):
    __tablename__ = "transfer_requests"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_holder = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_holder = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(TransferStatus), default=TransferStatus.requested, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    asset = relationship("Asset")
    requester = relationship("User", foreign_keys=[requested_by])
    holder = relationship("User", foreign_keys=[current_holder])
    target = relationship("User", foreign_keys=[target_holder])
    approver = relationship("User", foreign_keys=[approved_by])
