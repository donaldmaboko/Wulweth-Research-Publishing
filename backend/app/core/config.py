"""Application configuration (12-factor, environment driven)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    # -- core ---------------------------------------------------------------
    app_name: str = "Wulweth Research & Publishing API"
    environment: str = "development"  # development | staging | production
    public_url: str = "http://localhost:3000"
    frontend_origin: str = "http://localhost:3000"
    api_prefix: str = "/api"

    # -- security -----------------------------------------------------------
    secret_key: str = "dev-only-secret-change-me-in-production-0123456789"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7-day sessions (sliding refresh)
    encryption_key: str = ""  # Fernet key for document encryption at rest (blank => derived)
    rate_limit_enabled: bool = True

    # -- database -----------------------------------------------------------
    database_url: str = (
        "postgresql+psycopg2://postgres@/wulweth?host=/home/user/.pgdata"
    )
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # -- storage ------------------------------------------------------------
    data_dir: str = str(BASE_DIR / ".data")
    max_upload_mb: int = 25

    # -- payments (provider abstraction; see app/services/payments.py) -------
    payment_provider: str = "manual"  # manual | stripe
    stripe_api_key: str = ""
    stripe_webhook_secret: str = ""
    default_fee_percent: float = 15.0

    # -- email (dev writes to DB + stdout; production: SMTP) ----------------
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "no-reply@wulweth.example"

    @property
    def storage_dir(self) -> Path:
        return Path(self.data_dir) / "storage"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    os.makedirs(s.storage_dir, exist_ok=True)
    return s


settings = get_settings()
