from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.modules.auth.router import router as auth_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="AssetFlow API",
        description="Enterprise Asset & Resource Management Platform",
        version="0.1.0",
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

    # Future routers — add here as modules are built:
    # app.include_router(organization_router, prefix="/api")
    # app.include_router(assets_router, prefix="/api")
    # app.include_router(allocation_router, prefix="/api")
    # app.include_router(booking_router, prefix="/api")
    # app.include_router(maintenance_router, prefix="/api")
    # app.include_router(audit_router, prefix="/api")
    # app.include_router(reports_router, prefix="/api")
    # app.include_router(notifications_router, prefix="/api")
    # app.include_router(dashboard_router, prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "AssetFlow"}

    return app


app = create_app()
