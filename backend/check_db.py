"""Test the PostgreSQL credentials in .env:  python check_db.py"""
import asyncio

from app.db.session import check_db_connection

if __name__ == "__main__":
    ok = asyncio.run(check_db_connection(dispose=True))
    raise SystemExit(0 if ok else 1)
