from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


EventStatus = Literal["active", "inactive", "completed", "archived"]


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: datetime
    admin: AdminUserRead


class EventStorageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    provider: str
    bucket_name: str
    region: str | None = None
    provisioning_status: str
    is_verified: bool
    last_error: str | None = None
    total_photos: int
    total_bytes: int
    verified_at: datetime | None = None


class EventCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    event_date: date
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    organizer_name: str | None = Field(default=None, max_length=150)
    organizer_contact: str | None = Field(default=None, max_length=50)
    status: EventStatus = "active"
    accepting_photos: bool = True
    enforce_time_window: bool = False

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Event name must be at least 2 characters.")
        return cleaned


class EventUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    organizer_name: str | None = Field(default=None, max_length=150)
    organizer_contact: str | None = Field(default=None, max_length=50)
    status: EventStatus | None = None
    accepting_photos: bool | None = None
    enforce_time_window: bool | None = None


class EventStatusUpdateRequest(BaseModel):
    status: EventStatus
    accepting_photos: bool | None = None


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_uid: str
    name: str
    description: str | None = None
    event_date: date
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    organizer_name: str | None = None
    organizer_contact: str | None = None
    status: str
    accepting_photos: bool
    enforce_time_window: bool
    access_code: str | None = None
    created_at: datetime
    updated_at: datetime
    storage: EventStorageRead | None = None


class EventProvisionResponse(BaseModel):
    event: EventRead
    provisioned: bool
    message: str


class DashboardStatsRead(BaseModel):
    total_events: int
    active_events: int
    completed_events: int
    inactive_events: int
    archived_events: int
    total_photos_uploaded: int
    total_storage_bytes: int
    recent_events: list[EventRead]


class EventAccessRequest(BaseModel):
    access_code: str = Field(min_length=1, max_length=20)


class PublicEventInfo(BaseModel):
    event_name: str
    event_date: date
    location: str | None = None
    description: str | None = None


class EventAccessResponse(BaseModel):
    session_token: str
    expires_at: datetime
    event: PublicEventInfo


class PublicSessionStatusResponse(BaseModel):
    valid: bool
    expires_at: datetime
    photos_uploaded: int
    event: PublicEventInfo


class PublicPhotoUploadResponse(BaseModel):
    photo_id: str
    event_name: str
    mime_type: str
    file_size: int
    uploaded_at: datetime
    photo_view_url: str
    qr_target_url: str
    qr_image_url: str
    qr_data_url: str


class PublicSessionPhotoItem(BaseModel):
    photo_id: str
    mime_type: str
    file_size: int
    uploaded_at: datetime
    photo_view_url: str
    qr_target_url: str
    qr_image_url: str


class PublicPhotoViewResponse(BaseModel):
    photo_id: str
    event_name: str
    event_date: date
    mime_type: str
    file_size: int
    uploaded_at: datetime
    image_url: str
    download_url: str
    download_enabled: bool = True


class AdminPhotoRead(BaseModel):
    photo_id: str
    event_uid: str
    event_name: str
    event_access_code: str
    bucket_name: str
    object_key: str
    original_filename: str | None = None
    stored_filename: str
    file_size: int
    mime_type: str
    upload_status: str
    is_public: bool
    uploaded_at: datetime
    image_url: str
    download_url: str
    qr_target_url: str | None = None
    qr_image_url: str | None = None
    scan_count: int = 0


class AdminPhotoListResponse(BaseModel):
    items: list[AdminPhotoRead]
    total: int
    total_bytes: int


class AdminPhotoUpdateRequest(BaseModel):
    is_public: bool

