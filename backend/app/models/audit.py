import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Date, Table
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── M2M association: audit_cycles ↔ auditor users ─────────────
audit_cycle_auditors = Table(
    "audit_cycle_auditors",
    Base.metadata,
    Column("cycle_id", Integer, ForeignKey("audit_cycles.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)


class AuditCycleStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class VerificationResult(str, enum.Enum):
    verified = "verified"
    missing = "missing"
    damaged = "damaged"


class AuditCycle(Base):
    __tablename__ = "audit_cycles"

    id = Column(Integer, primary_key=True, index=True)
    scope_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    location = Column(String(255), nullable=True)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    status = Column(Enum(AuditCycleStatus), default=AuditCycleStatus.open, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    department = relationship("Department")
    auditors = relationship("User", secondary=audit_cycle_auditors)
    items = relationship("AuditItem", back_populates="cycle")


class AuditItem(Base):
    __tablename__ = "audit_items"

    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("audit_cycles.id"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    expected_location = Column(String(255), nullable=True)
    verification = Column(Enum(VerificationResult), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    cycle = relationship("AuditCycle", back_populates="items")
    asset = relationship("Asset")
