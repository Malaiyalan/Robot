"""Test the PostgreSQL credentials in .env:  python check_db.py"""
import asyncio

from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


async def main():
    s = settings
    print(f"Connecting to {s.DB_USER}@{s.DB_HOST}:{s.DB_PORT}/{s.DB_NAME} ...")
    try:
        async with engine.connect() as conn:
            version = (await conn.execute(text("SELECT version()"))).scalar()
            print("✅ Connected:", version.split(",")[0])
    except Exception as e:
        print("❌ Connection failed:", e)
    finally:
        await engine.dispose()


asyncio.run(main())
