import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    asset_manager = "asset_manager"
    dept_head = "dept_head"
    employee = "employee"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.employee, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String(20), default="active", nullable=False)  # active / inactive
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    department = relationship("Department", back_populates="members", foreign_keys=[department_id])
    notifications = relationship("Notification", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user")
