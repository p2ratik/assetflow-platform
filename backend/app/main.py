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
    """
    On startup:
      1. CREATE all tables (idempotent — skips existing tables)
      2. CREATE SEQUENCE asset_tag_seq (idempotent — IF NOT EXISTS)
      3. ADD COLUMN categories.status (idempotent — checks information_schema first)
    This means the app works on a fresh DB with zero manual migration steps.
    """
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # Atomic tag generation sequence
        conn.execute(text(
            "CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1 INCREMENT 1 NO CYCLE"
        ))
        # Soft-delete column for categories
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='categories' AND column_name='status'
                ) THEN
                    ALTER TABLE categories
                    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
                END IF;
            END$$;
        """))
        conn.commit()

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
