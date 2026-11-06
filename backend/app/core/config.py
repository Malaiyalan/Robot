from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


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
