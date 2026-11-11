from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


def _env(*keys: str, default: str = "") -> str:
    for key in keys:
        val = os.environ.get(key)
        if val is not None and val.strip():
            return val.strip()
    return default


class Settings(BaseSettings):
    PROJECT_NAME: str = "Robot App API"
    API_V1_PREFIX: str = "/api/v1"
    PORT: int = 8000

    # PostgreSQL credentials (set these in .env)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""
    DB_NAME: str = "robot_app"

    # Optional: full URL overrides the DB_* values above
    DATABASE_URL: str | None = None

    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    CORS_ORIGINS: list[str] = ["*"]  # tighten this in production

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    # Super Admin initial development configuration & session signing
    SUPER_ADMIN_USERNAME: str = _env("SUPER_ADMIN_USERNAME", default="Supera")
    SUPER_ADMIN_PASSWORD: str = _env("SUPER_ADMIN_PASSWORD", default="Superp")
    SESSION_SECRET_KEY: str = _env("SESSION_SECRET_KEY", "SECRET_KEY", default="dev-change-this-session-secret-key")
    ADMIN_SESSION_HOURS: int = int(os.environ.get("ADMIN_SESSION_HOURS") or 12)
    EVENT_SESSION_HOURS: int = int(os.environ.get("EVENT_SESSION_HOURS") or 12)

    # Cloudflare R2 S3-compatible configuration (supports standard CLOUDFLARE_* and legacy keys)
    CLOUDFLARE_ACCOUNT_ID: str = _env("CLOUDFLARE_ACCOUNT_ID", "Account_ID")
    CLOUDFLARE_ACCESS_KEY_ID: str = _env("CLOUDFLARE_ACCESS_KEY_ID", "Access_Key_ID")
    CLOUDFLARE_SECRET_ACCESS_KEY: str = _env("CLOUDFLARE_SECRET_ACCESS_KEY", "Secret_Access_Key")
    CLOUDFLARE_R2_ENDPOINT: str = _env("CLOUDFLARE_R2_ENDPOINT", "S3_API")
    CLOUDFLARE_R2_PUBLIC_URL: str = _env("CLOUDFLARE_R2_PUBLIC_URL")
    CLOUDFLARE_R2_DEFAULT_BUCKET: str = _env("CLOUDFLARE_R2_DEFAULT_BUCKET", "Bucket")

    # Upload & Public URL configuration
    MAX_UPLOAD_SIZE_MB: int = int(os.environ.get("MAX_UPLOAD_SIZE_MB") or 15)
    PUBLIC_APP_URL: str = _env("PUBLIC_APP_URL", default="http://localhost:5173").rstrip("/")

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    @property
    def r2_endpoint(self) -> str:
        if self.CLOUDFLARE_R2_ENDPOINT:
            return self.CLOUDFLARE_R2_ENDPOINT
        if self.CLOUDFLARE_ACCOUNT_ID:
            return f"https://{self.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return ""

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

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
