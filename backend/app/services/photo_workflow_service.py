import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import generate_session_token
from app.models.event_photography import Event, EventPhoto, EventSession, PhotoQRCode
from app.services.image_validation import ImageValidationError, validate_uploaded_image
from app.services.qr_service import generate_qr_data_url
from app.services.r2_service import R2StorageError, r2_service

_ACCESS_CODE_RE = re.compile(r"^[A-Z0-9]{10}$")


def _is_within_event_schedule(event: Event) -> bool:
    """Check optional date/time window against local system time when enforce_time_window is enabled."""
    if not event.enforce_time_window:
        return True
    now_local = datetime.now()
    if event.event_date != now_local.date():
        return False
    current_t = now_local.time()
    if event.start_time and current_t < event.start_time:
        return False
    if event.end_time and current_t > event.end_time:
        return False
    return True


async def create_event_session_by_code(
    db: AsyncSession,
    raw_code: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, EventSession, Event]:
    code = raw_code.strip().upper()
    if not _ACCESS_CODE_RE.match(code):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid event code.")

    stmt = select(Event).options(selectinload(Event.storage)).where(Event.access_code == code)
    event = (await db.execute(stmt)).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid event code.")

    if (
        event.status != "active"
        or not event.accepting_photos
        or not event.storage
        or not event.storage.is_verified
        or event.storage.provisioning_status != "provisioned"
        or not _is_within_event_schedule(event)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This event is currently unavailable.")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.EVENT_SESSION_HOURS)
    token = generate_session_token()
    session = EventSession(
        event_id=event.id,
        session_token=token,
        access_code_used=code,
        user_agent=user_agent[:500] if user_agent else None,
        ip_address=ip_address[:64] if ip_address else None,
        is_active=True,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return token, session, event


async def validate_event_session_token(
    db: AsyncSession, raw_token: str
) -> tuple[EventSession, Event]:
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Event session is required.")

    now = datetime.now(timezone.utc)
    stmt = (
        select(EventSession)
        .options(selectinload(EventSession.event).selectinload(Event.storage))
        .where(
            EventSession.session_token == raw_token,
            EventSession.is_active.is_(True),
            EventSession.expires_at > now,
        )
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if not session or not session.event:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired event session.")

    event = session.event
    if (
        event.status != "active"
        or not event.accepting_photos
        or not event.storage
        or not event.storage.is_verified
        or event.storage.provisioning_status != "provisioned"
        or not _is_within_event_schedule(event)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This event is currently unavailable.")

    return session, event


async def upload_photo_for_session(
    db: AsyncSession,
    session: EventSession,
    event: Event,
    file_bytes: bytes,
    original_filename: str | None,
    public_app_base_url: str,
) -> tuple[EventPhoto, PhotoQRCode, str]:
    if not event.storage or not event.storage.is_verified:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Event storage is not provisioned.")

    try:
        validated = validate_uploaded_image(file_bytes)
    except ImageValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    seq_val = (await db.execute(text("SELECT nextval('event_photo_code_seq')"))).scalar_one()
    photo_code = f"PHOTO-{int(seq_val):06d}"

    now = datetime.now(timezone.utc)
    stored_filename = f"{photo_code.lower()}-{secrets.token_hex(4)}.{validated.extension}"
    object_key = f"event-photos/{event.event_uid}/{now:%Y}/{now:%m}/{stored_filename}"
    bucket_name = event.storage.bucket_name

    try:
        await r2_service.upload_photo(bucket_name, object_key, validated.data, validated.mime_type)
    except R2StorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    target_url = f"{public_app_base_url.rstrip('/')}/photos/{photo_code}"
    qr_data_url = generate_qr_data_url(target_url)

    photo = EventPhoto(
        photo_code=photo_code,
        event_id=event.id,
        event_session_id=session.id,
        event_access_code=event.access_code or session.access_code_used,
        bucket_name=bucket_name,
        object_key=object_key,
        original_filename=original_filename[:255] if original_filename else stored_filename,
        stored_filename=stored_filename,
        file_size=validated.file_size,
        mime_type=validated.mime_type,
        upload_status="uploaded",
        is_public=True,
    )
    try:
        db.add(photo)
        await db.flush()

        qr = PhotoQRCode(
            photo_id=photo.id,
            qr_token=photo_code,
            target_url=target_url,
            is_active=True,
        )
        db.add(qr)

        event.storage.total_photos += 1
        event.storage.total_bytes += validated.file_size
        session.photos_uploaded += 1
        session.last_activity_at = now

        await db.commit()
        await db.refresh(photo)
        await db.refresh(qr)
        return photo, qr, qr_data_url
    except Exception:
        await db.rollback()
        try:
            await r2_service.delete_photo(bucket_name, object_key)
        except Exception:
            pass
        raise


async def get_public_photo_by_code(db: AsyncSession, photo_code: str) -> EventPhoto:
    normalized = photo_code.strip().upper()
    stmt = (
        select(EventPhoto)
        .options(selectinload(EventPhoto.event), selectinload(EventPhoto.qr_code))
        .where(EventPhoto.photo_code == normalized)
    )
    photo = (await db.execute(stmt)).scalar_one_or_none()
    if (
        not photo
        or photo.upload_status != "uploaded"
        or not photo.is_public
        or not photo.event
        or photo.event.status == "archived"
        or (photo.qr_code is not None and not photo.qr_code.is_active)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sorry, this photograph is currently unavailable.",
        )
    return photo


async def delete_photo_and_r2_object(db: AsyncSession, photo: EventPhoto) -> None:
    await r2_service.delete_photo(photo.bucket_name, photo.object_key)
    if photo.event and photo.event.storage:
        photo.event.storage.total_photos = max(0, photo.event.storage.total_photos - 1)
        photo.event.storage.total_bytes = max(0, photo.event.storage.total_bytes - photo.file_size)
    await db.delete(photo)
    await db.commit()

