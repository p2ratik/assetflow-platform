from pydantic import BaseModel


class UtilizationPoint(BaseModel):
    category: str
    total_assets: int
    active_assets: int
    utilization_pct: float


class MaintenanceTrendPoint(BaseModel):
    month: str
    requests: int
    resolved: int


class AssetUsagePoint(BaseModel):
    asset_id: int
    asset_tag: str
    asset_name: str
    category: str | None = None
    usage_count: int
    bookings: int
    allocations: int
    booking_hours: float


class IdleAssetPoint(BaseModel):
    asset_id: int
    asset_tag: str
    asset_name: str
    category: str | None = None
    status: str
    days_since_activity: int | None = None


class ReportSummary(BaseModel):
    total_assets: int
    active_assets: int
    utilization_pct: float
    maintenance_requests: int
    resolved_maintenance: int
    total_bookings: int


class ReportsOverview(BaseModel):
    summary: ReportSummary
    utilization_by_category: list[UtilizationPoint]
    maintenance_trend: list[MaintenanceTrendPoint]
    most_used_assets: list[AssetUsagePoint]
    idle_assets: list[IdleAssetPoint]
