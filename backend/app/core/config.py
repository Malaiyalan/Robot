import json
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_FILE)


def _parse_cors_origins(raw: str | None) -> list[str]:
    """Parse CORS_ORIGINS from a JSON array or comma-separated env string."""
    if not raw or not raw.strip():
        return ["*"]
    value = raw.strip()
    if value.startswith("["):
        return json.loads(value)
    return [origin.strip() for origin in value.split(",") if origin.strip()]


class Settings(BaseSettings):
    PROJECT_NAME: str = os.environ.get("PROJECT_NAME", "Robot App API")
    API_V1_PREFIX: str = os.environ.get("API_V1_PREFIX", "/api/v1")
    PORT: int = int(os.environ.get("PORT") or 8000)

    # PostgreSQL credentials (loaded from backend/.env)
    DB_HOST: str = os.environ.get("DB_HOST", "localhost")
    DB_PORT: int = int(os.environ.get("DB_PORT") or 5432)
    DB_USER: str = os.environ.get("DB_USER", "postgres")
    DB_PASSWORD: str = os.environ.get("DB_PASSWORD", "")
    DB_NAME: str = os.environ.get("DB_NAME", "robot_app")

    # Optional: full URL overrides the DB_* values above
    DATABASE_URL: str | None = os.environ.get("DATABASE_URL") or None

    DB_POOL_SIZE: int = int(os.environ.get("DB_POOL_SIZE") or 10)
    DB_MAX_OVERFLOW: int = int(os.environ.get("DB_MAX_OVERFLOW") or 20)
    CORS_ORIGINS: list[str] = _parse_cors_origins(os.environ.get("CORS_ORIGINS"))

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    @property
    def database_url(self) -> str:
        """Async SQLAlchemy URL. Special characters in the password are escaped automatically."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return URL.create(
            "postgresql+asyncpg",
            username=self.DB_USER,
            password=self.DB_PASSWORD,
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
        ).render_as_string(hide_password=False)


settings = Settings()
