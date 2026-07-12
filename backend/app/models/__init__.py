# Import all models so Alembic can detect them via Base.metadata
from app.models.user import User
from app.models.department import Department
from app.models.category import Category
from app.models.asset import Asset
from app.models.allocation import Allocation
from app.models.transfer_request import TransferRequest
from app.models.booking import Booking
from app.models.maintenance import MaintenanceRequest
from app.models.audit import AuditCycle, AuditItem, audit_cycle_auditors
from app.models.notification import Notification
from app.models.activity_log import ActivityLog

__all__ = [
    "User",
    "Department",
    "Category",
    "Asset",
    "Allocation",
    "TransferRequest",
    "Booking",
    "MaintenanceRequest",
    "AuditCycle",
    "AuditItem",
    "audit_cycle_auditors",
    "Notification",
    "ActivityLog",
]
