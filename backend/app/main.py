from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.modules.auth.router import router as auth_router
from app.modules.organization.router import router as organization_router
from app.modules.assets.router import router as assets_router
from app.modules.dashboard.router import router as dashboard_router

# Import all models so Base.metadata is fully populated before create_all
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all DB tables on startup (idempotent — skips existing tables)."""
    Base.metadata.create_all(bind=engine)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="AssetFlow API",
        description="Enterprise Asset & Resource Management Platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────
    app.include_router(auth_router, prefix="/api")
    app.include_router(organization_router, prefix="/api")
    app.include_router(assets_router, prefix="/api")
    app.include_router(dashboard_router, prefix="/api")

    # Future routers — add here as modules are built:
    # app.include_router(allocation_router, prefix="/api")   # Member B
    # app.include_router(booking_router, prefix="/api")      # Member B
    # app.include_router(maintenance_router, prefix="/api")  # Member C
    # app.include_router(audit_router, prefix="/api")        # Member C
    # app.include_router(reports_router, prefix="/api")      # Member C
    # app.include_router(notifications_router, prefix="/api")# Member C

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "AssetFlow"}

    return app


app = create_app()
