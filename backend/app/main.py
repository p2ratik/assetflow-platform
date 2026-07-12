from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.modules.auth.router import router as auth_router
from app.modules.organization.router import router as organization_router
from app.modules.assets.router import router as assets_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.allocation.router import router as allocation_router, transfer_router
from app.modules.users.router import router as users_router
from app.modules.booking.router import router as booking_router
from app.modules.maintenance.router import router as maintenance_router
from app.modules.reports.router import router as reports_router

# Import all models so Base.metadata is fully populated before create_all
import app.models  # noqa: F401


# ── Default seed data ──────────────────────────────────────────────────────────
DEFAULT_CATEGORIES = [
    "Laptop", "Desktop", "Monitor", "Printer", "Projector",
    "Phone", "Tablet", "Server", "Networking Equipment",
    "Office Furniture", "Vehicle", "Other",
]

DEFAULT_DEPARTMENTS = [
    "Engineering", "Finance", "HR", "Marketing", "Operations", "IT",
]


def _seed_defaults(conn):
    """Seed default categories and departments only if the tables are empty."""
    from sqlalchemy import text

    # Seed categories
    cat_count = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar()
    if cat_count == 0:
        for name in DEFAULT_CATEGORIES:
            conn.execute(text(
                "INSERT INTO categories (name, custom_fields, status) "
                "VALUES (:name, '{}', 'active') ON CONFLICT (name) DO NOTHING"
            ), {"name": name})

    # Seed departments
    dept_count = conn.execute(text("SELECT COUNT(*) FROM departments")).scalar()
    if dept_count == 0:
        for name in DEFAULT_DEPARTMENTS:
            conn.execute(text(
                "INSERT INTO departments (name, status) "
                "VALUES (:name, 'active') ON CONFLICT (name) DO NOTHING"
            ), {"name": name})

    conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    On startup:
      1. CREATE all tables (idempotent — skips existing tables)
      2. CREATE SEQUENCE asset_tag_seq (idempotent — IF NOT EXISTS)
      3. ADD COLUMN categories.status (idempotent — checks information_schema first)
      4. Seed default categories + departments if empty
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

        # Auto-seed defaults so a fresh install has working dropdowns
        _seed_defaults(conn)

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

    app.include_router(allocation_router, prefix="/api")  # Member B Screen 5
    app.include_router(transfer_router, prefix="/api")    # Member B Screen 5
    app.include_router(users_router, prefix="/api")       # user picker dropdown
    app.include_router(booking_router, prefix="/api")     # Member B Screen 6
    app.include_router(maintenance_router, prefix="/api") # Member C Screen 7
    app.include_router(reports_router, prefix="/api")     # Member C Screen 9

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "AssetFlow"}

    @app.post("/api/admin/seed-defaults", tags=["admin"])
    def seed_defaults_endpoint():
        """Dev-only: re-seed default categories and departments if tables are empty."""
        with engine.connect() as conn:
            _seed_defaults(conn)
        return {"detail": "Seed complete"}

    return app


app = create_app()
