from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    head_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    parent_dept_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String(20), default="active", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    head = relationship("User", foreign_keys=[head_id])
    parent = relationship("Department", remote_side="Department.id", backref="children")
    members = relationship("User", back_populates="department", foreign_keys="User.department_id")
