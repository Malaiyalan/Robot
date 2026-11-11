"""Start the API:  python run.py   (like `node server.js`)"""
import asyncio
import uvicorn

from app.core.config import settings
from app.db.session import check_db_connection

if __name__ == "__main__":
    print(f"🚀 API starting on http://0.0.0.0:{settings.PORT}  (docs: /docs, health: /health)", flush=True)
    asyncio.run(check_db_connection(dispose=True))
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
