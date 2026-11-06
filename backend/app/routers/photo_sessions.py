from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.routers.crud_factory import build_crud_router
from app.schemas.photo_session import PhotoSessionCreate, PhotoSessionRead, PhotoSessionUpdate
from app.services.crud_services import photo_session_service

router = build_crud_router(
    prefix="/photo-sessions", tag="PhotoSession", service=photo_session_service,
    Create=PhotoSessionCreate, Update=PhotoSessionUpdate, Read=PhotoSessionRead,
)


# The QR code printed on the robot screen points here: /photo-sessions/public/{token}

@router.get("/public/{token}", response_model=PhotoSessionRead, include_in_schema=True)
async def get_session_by_token(token: str, db: AsyncSession = Depends(get_db)):
    session = await photo_session_service.get_by_token(db, token)
    if not session:
        raise HTTPException(404, "Photo session not found")
    return session
