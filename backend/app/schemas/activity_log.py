from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActivityLogCreate(BaseModel):
    device_id: int | None = None
    user_id: int | None = None
    action: str
    details: dict | None = None


class ActivityLogUpdate(BaseModel):
    action: str | None = None
    details: dict | None = None


class ActivityLogRead(ActivityLogCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
