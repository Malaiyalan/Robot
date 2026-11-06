from fastapi import APIRouter

from app.routers import photo_sessions, users
from app.routers.crud_factory import build_crud_router
from app.schemas.activity_log import ActivityLogCreate, ActivityLogRead, ActivityLogUpdate
from app.schemas.device import DeviceCreate, DeviceRead, DeviceUpdate
from app.schemas.saree import SareeCreate, SareeRead, SareeUpdate
from app.services.crud_services import activity_log_service, device_service, saree_service

api_router = APIRouter()
api_router.include_router(users.router)
api_router.include_router(build_crud_router(
    prefix="/devices", tag="Device", service=device_service,
    Create=DeviceCreate, Update=DeviceUpdate, Read=DeviceRead))
api_router.include_router(build_crud_router(
    prefix="/activity-logs", tag="ActivityLog", service=activity_log_service,
    Create=ActivityLogCreate, Update=ActivityLogUpdate, Read=ActivityLogRead))
api_router.include_router(build_crud_router(
    prefix="/sarees", tag="Saree", service=saree_service,
    Create=SareeCreate, Update=SareeUpdate, Read=SareeRead))
api_router.include_router(photo_sessions.router)
