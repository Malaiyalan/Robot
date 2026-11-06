from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog, Device, PhotoSession, Saree
from app.schemas.activity_log import ActivityLogCreate, ActivityLogUpdate
from app.schemas.device import DeviceCreate, DeviceUpdate
from app.schemas.photo_session import PhotoSessionCreate, PhotoSessionUpdate
from app.schemas.saree import SareeCreate, SareeUpdate
from app.services.crud_base import CRUDBase

device_service = CRUDBase[Device, DeviceCreate, DeviceUpdate](Device)
activity_log_service = CRUDBase[ActivityLog, ActivityLogCreate, ActivityLogUpdate](ActivityLog)
saree_service = CRUDBase[Saree, SareeCreate, SareeUpdate](Saree)


class PhotoSessionService(CRUDBase[PhotoSession, PhotoSessionCreate, PhotoSessionUpdate]):
    async def get_by_token(self, db: AsyncSession, token: str) -> PhotoSession | None:
        result = await db.execute(select(PhotoSession).where(PhotoSession.token == token))
        return result.scalar_one_or_none()


photo_session_service = PhotoSessionService(PhotoSession)
