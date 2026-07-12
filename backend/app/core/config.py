from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────
    # Must be set in .env — no hardcoded default to prevent silent wrong-host connections
    DATABASE_URL: str

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET: str = "CHANGE-ME-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── App ───────────────────────────────────────────────────
    APP_NAME: str = "AssetFlow"
    DEBUG: bool = True

    # ── Cloudinary (optional — photo uploads) ─────────────────
    # Set these in .env to enable real photo upload to Cloudinary.
    # If absent, photo upload is skipped gracefully (no broken flows).
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    @property
    def cloudinary_enabled(self) -> bool:
        return bool(self.CLOUDINARY_CLOUD_NAME and self.CLOUDINARY_API_KEY and self.CLOUDINARY_API_SECRET)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
