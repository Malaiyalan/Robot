from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

DeviceType = Literal["wedding_photo", "saree_tryon"]
DeviceStatus = Literal["online", "offline", "maintenance"]


class DeviceCreate(BaseModel):
    name: str
    serial_number: str
    device_type: DeviceType = "wedding_photo"
    status: DeviceStatus = "offline"
    location: str | None = None
    owner_id: int | None = None


class DeviceUpdate(BaseModel):
    name: str | None = None
    device_type: DeviceType | None = None
    status: DeviceStatus | None = None
    location: str | None = None
    owner_id: int | None = None


class DeviceRead(DeviceCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
