from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_kwargs: dict = {"pool_pre_ping": True}
if not settings.database_url.startswith("sqlite"):
    _kwargs.update(pool_size=settings.DB_POOL_SIZE, max_overflow=settings.DB_MAX_OVERFLOW)

engine = create_async_engine(settings.database_url, echo=False, **_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def _db_target_label() -> str:
    url = engine.url
    if url.host:
        user = f"{url.username}@" if url.username else ""
        port = f":{url.port}" if url.port else ""
        db = f"/{url.database}" if url.database else ""
        return f"{user}{url.host}{port}{db}"
    return url.render_as_string(hide_password=True)


async def check_db_connection(*, dispose: bool = False) -> bool:
    """Verify database connectivity and print the status to the terminal."""
    target = _db_target_label()
    try:
        async with engine.connect() as conn:
            version = (await conn.execute(text("SELECT version()"))).scalar()
            db_version = version.split(",")[0] if version else "connected"
            print(f"✅ Database connected: {db_version} ({target})", flush=True)
            return True
    except Exception as e:
        print(f"❌ Database not connected ({target}): {e}", flush=True)
        return False
    finally:
        if dispose:
            await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session
