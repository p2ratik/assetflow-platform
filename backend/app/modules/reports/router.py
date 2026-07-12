from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.modules.reports import service
from app.schemas.reports import ReportsOverview

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/overview", response_model=ReportsOverview)
def get_reports_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin", "asset_manager", "dept_head"])),
):
    return service.get_overview(db)


@router.get("/export")
def export_reports_csv(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin", "asset_manager", "dept_head"])),
):
    csv_text = service.build_csv_export(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=assetflow-reports.csv"},
    )
