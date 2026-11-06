"""Start the API:  python run.py   (like `node server.js`)"""
import uvicorn

from app.core.config import settings

if __name__ == "__main__":
    print(f"🚀 API starting on http://0.0.0.0:{settings.PORT}  (docs: /docs, health: /health)")
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
