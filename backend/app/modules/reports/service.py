from calendar import month_abbr
from datetime import datetime, timezone
from io import StringIO

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.allocation import Allocation
from app.models.asset import Asset, AssetStatus
from app.models.booking import Booking, BookingStatus
from app.models.category import Category
from app.models.maintenance import MaintenanceRequest, MaintenanceStatus
from app.schemas.reports import (
    AssetUsagePoint,
    IdleAssetPoint,
    MaintenanceTrendPoint,
    ReportSummary,
    ReportsOverview,
    UtilizationPoint,
)


ACTIVE_STATUSES = {
    AssetStatus.allocated,
    AssetStatus.reserved,
    AssetStatus.under_maintenance,
}


def _month_key(year: int, month: int) -> str:
    return f"{year}-{month:02d}"


def _month_label(key: str) -> str:
    year, month = key.split("-")
    return f"{month_abbr[int(month)]} {year[-2:]}"


def _last_month_keys(count: int = 6) -> list[str]:
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month
    keys = []
    for _ in range(count):
        keys.append(_month_key(year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(keys))


def get_summary(db: Session) -> ReportSummary:
    total_assets = db.query(func.count(Asset.id)).scalar() or 0
    active_assets = db.query(func.count(Asset.id)).filter(Asset.status.in_(ACTIVE_STATUSES)).scalar() or 0
    maintenance_requests = db.query(func.count(MaintenanceRequest.id)).scalar() or 0
    resolved_maintenance = db.query(func.count(MaintenanceRequest.id)).filter(
        MaintenanceRequest.status == MaintenanceStatus.resolved
    ).scalar() or 0
    total_bookings = db.query(func.count(Booking.id)).filter(
        Booking.status != BookingStatus.cancelled
    ).scalar() or 0

    return ReportSummary(
        total_assets=total_assets,
        active_assets=active_assets,
        utilization_pct=round((active_assets / total_assets) * 100, 1) if total_assets else 0,
        maintenance_requests=maintenance_requests,
        resolved_maintenance=resolved_maintenance,
        total_bookings=total_bookings,
    )


def get_utilization_by_category(db: Session) -> list[UtilizationPoint]:
    rows = (
        db.query(Category.name, Asset.status, func.count(Asset.id))
        .join(Asset, Asset.category_id == Category.id)
        .group_by(Category.name, Asset.status)
        .all()
    )
    grouped: dict[str, dict[str, int]] = {}
    for category, status, count in rows:
        bucket = grouped.setdefault(category, {"total": 0, "active": 0})
        bucket["total"] += count
        if status in ACTIVE_STATUSES:
            bucket["active"] += count

    points = []
    for category, values in grouped.items():
        total = values["total"]
        active = values["active"]
        points.append(UtilizationPoint(
            category=category,
            total_assets=total,
            active_assets=active,
            utilization_pct=round((active / total) * 100, 1) if total else 0,
        ))
    return sorted(points, key=lambda point: point.utilization_pct, reverse=True)


def get_maintenance_trend(db: Session, months: int = 6) -> list[MaintenanceTrendPoint]:
    keys = _last_month_keys(months)
    buckets = {key: {"requests": 0, "resolved": 0} for key in keys}
    start_year, start_month = map(int, keys[0].split("-"))
    start_date = datetime(start_year, start_month, 1, tzinfo=timezone.utc)

    rows = db.query(MaintenanceRequest).filter(MaintenanceRequest.created_at >= start_date).all()
    for row in rows:
        if not row.created_at:
            continue
        key = _month_key(row.created_at.year, row.created_at.month)
        if key not in buckets:
            continue
        buckets[key]["requests"] += 1
        if row.status == MaintenanceStatus.resolved:
            buckets[key]["resolved"] += 1

    return [
        MaintenanceTrendPoint(month=_month_label(key), **values)
        for key, values in buckets.items()
    ]


def get_most_used_assets(db: Session, limit: int = 8) -> list[AssetUsagePoint]:
    assets = db.query(Asset).all()
    allocation_counts = dict(
        db.query(Allocation.asset_id, func.count(Allocation.id))
        .group_by(Allocation.asset_id)
        .all()
    )
    booking_counts = dict(
        db.query(Booking.asset_id, func.count(Booking.id))
        .filter(Booking.status != BookingStatus.cancelled)
        .group_by(Booking.asset_id)
        .all()
    )
    bookings = db.query(Booking).filter(Booking.status != BookingStatus.cancelled).all()
    booking_hours: dict[int, float] = {}
    for booking in bookings:
        hours = max((booking.end_time - booking.start_time).total_seconds() / 3600, 0)
        booking_hours[booking.asset_id] = booking_hours.get(booking.asset_id, 0) + hours

    points = []
    for asset in assets:
        allocations = allocation_counts.get(asset.id, 0)
        booking_total = booking_counts.get(asset.id, 0)
        usage_count = allocations + booking_total
        if usage_count == 0:
            continue
        points.append(AssetUsagePoint(
            asset_id=asset.id,
            asset_tag=asset.tag,
            asset_name=asset.name,
            category=asset.category.name if asset.category else None,
            usage_count=usage_count,
            bookings=booking_total,
            allocations=allocations,
            booking_hours=round(booking_hours.get(asset.id, 0), 1),
        ))

    return sorted(points, key=lambda point: (point.usage_count, point.booking_hours), reverse=True)[:limit]


def get_idle_assets(db: Session, limit: int = 8) -> list[IdleAssetPoint]:
    assets = db.query(Asset).filter(Asset.status == AssetStatus.available).all()
    allocation_dates = dict(
        db.query(Allocation.asset_id, func.max(Allocation.allocated_at))
        .group_by(Allocation.asset_id)
        .all()
    )
    booking_dates = dict(
        db.query(Booking.asset_id, func.max(Booking.end_time))
        .filter(Booking.status != BookingStatus.cancelled)
        .group_by(Booking.asset_id)
        .all()
    )
    now = datetime.now(timezone.utc)
    points = []
    for asset in assets:
        last_dates = [d for d in (allocation_dates.get(asset.id), booking_dates.get(asset.id)) if d]
        last_activity = max(last_dates) if last_dates else None
        days_since = (now - last_activity).days if last_activity else None
        points.append(IdleAssetPoint(
            asset_id=asset.id,
            asset_tag=asset.tag,
            asset_name=asset.name,
            category=asset.category.name if asset.category else None,
            status=asset.status.value,
            days_since_activity=days_since,
        ))

    return sorted(
        points,
        key=lambda point: point.days_since_activity if point.days_since_activity is not None else 99999,
        reverse=True,
    )[:limit]


def get_overview(db: Session) -> ReportsOverview:
    return ReportsOverview(
        summary=get_summary(db),
        utilization_by_category=get_utilization_by_category(db),
        maintenance_trend=get_maintenance_trend(db),
        most_used_assets=get_most_used_assets(db),
        idle_assets=get_idle_assets(db),
    )


def build_csv_export(db: Session) -> str:
    overview = get_overview(db)
    output = StringIO()
    output.write("section,label,value\n")
    output.write(f"summary,total_assets,{overview.summary.total_assets}\n")
    output.write(f"summary,active_assets,{overview.summary.active_assets}\n")
    output.write(f"summary,utilization_pct,{overview.summary.utilization_pct}\n")
    output.write(f"summary,maintenance_requests,{overview.summary.maintenance_requests}\n")
    output.write(f"summary,resolved_maintenance,{overview.summary.resolved_maintenance}\n")
    output.write(f"summary,total_bookings,{overview.summary.total_bookings}\n")
    for point in overview.utilization_by_category:
        output.write(f"utilization,{point.category},{point.utilization_pct}\n")
    for point in overview.maintenance_trend:
        output.write(f"maintenance_trend,{point.month},{point.requests}\n")
    for point in overview.most_used_assets:
        output.write(f"most_used,{point.asset_tag},{point.usage_count}\n")
    for point in overview.idle_assets:
        output.write(f"idle,{point.asset_tag},{point.days_since_activity if point.days_since_activity is not None else 'never_used'}\n")
    return output.getvalue()
