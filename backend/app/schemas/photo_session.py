from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PhotoSessionCreate(BaseModel):
    device_id: int
    image_urls: list[str] = []
    expires_at: datetime | None = None


class PhotoSessionUpdate(BaseModel):
    image_urls: list[str] | None = None
    expires_at: datetime | None = None


class PhotoSessionRead(PhotoSessionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    token: str
    created_at: datetime
