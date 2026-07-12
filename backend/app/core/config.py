from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://user:pass@localhost:5432/assetflow"

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET: str = "CHANGE-ME-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── App ───────────────────────────────────────────────────
    APP_NAME: str = "AssetFlow"
    DEBUG: bool = True

    # ── Cloudinary (stretch) ──────────────────────────────────
    CLOUDINARY_URL: Optional[str] = None

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
