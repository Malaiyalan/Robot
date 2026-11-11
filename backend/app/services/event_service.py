import secrets
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import generate_event_access_code, generate_event_uid, sanitize_bucket_name
from app.models.event_photography import Event, EventPhoto, EventStorage
from app.schemas.event_photography import (
    DashboardStatsRead,
    EventCreateRequest,
    EventRead,
    EventStatusUpdateRequest,
    EventUpdateRequest,
)
from app.services.r2_service import R2StorageError, r2_service


async def _generate_unique_event_uid(db: AsyncSession) -> str:
    for _ in range(10):
        uid = generate_event_uid()
        exists = (await db.execute(select(Event.id).where(Event.event_uid == uid))).scalar_one_or_none()
        if not exists:
            return uid
    raise RuntimeError("Failed to generate unique event UID")


async def _generate_unique_access_code(db: AsyncSession) -> str:
    for _ in range(25):
        code = generate_event_access_code(10)
        exists = (await db.execute(select(Event.id).where(Event.access_code == code))).scalar_one_or_none()
        if not exists:
            return code
    raise RuntimeError("Failed to generate unique 10-character event access code")


async def _generate_unique_bucket_name(db: AsyncSession, event_name: str, force_suffix: bool = False) -> str:
    suffix = secrets.token_hex(2) if force_suffix else None
    for _ in range(15):
        candidate = sanitize_bucket_name(event_name, suffix=suffix)
        exists = (
            await db.execute(select(EventStorage.id).where(EventStorage.bucket_name == candidate))
        ).scalar_one_or_none()
        if not exists:
            return candidate
        suffix = secrets.token_hex(2)
    raise RuntimeError("Failed to generate unique R2 bucket name")


async def _provision_storage_for_event(
    db: AsyncSession, event: Event, storage: EventStorage
) -> tuple[bool, str]:
    if storage.provisioning_status == "provisioned" and storage.is_verified:
        if not event.access_code:
            event.access_code = await _generate_unique_access_code(db)
            await db.commit()
            await db.refresh(event)
        return True, "Storage bucket is already provisioned and verified."

    try:
        try:
            res = await r2_service.create_and_verify_bucket(storage.bucket_name)
        except R2StorageError as err:
            if err.code == "BucketAlreadyExists":
                # Name collision in global R2 namespace before verification: allocate a fresh unique suffix once
                storage.bucket_name = await _generate_unique_bucket_name(db, event.name, force_suffix=True)
                await db.commit()
                res = await r2_service.create_and_verify_bucket(storage.bucket_name)
            else:
                raise

        now = datetime.now(timezone.utc)
        storage.provisioning_status = "provisioned"
        storage.is_verified = True
        storage.region = res.get("region")
        storage.last_error = None
        storage.verified_at = now
        if not event.access_code:
            event.access_code = await _generate_unique_access_code(db)
        await db.commit()
        await db.refresh(event)
        await db.refresh(storage)
        return True, f"Cloudflare R2 bucket '{storage.bucket_name}' provisioned and verified."
    except R2StorageError as err:
        storage.provisioning_status = "failed"
        storage.is_verified = False
        storage.last_error = err.message
        await db.commit()
        await db.refresh(event)
        await db.refresh(storage)
        return False, err.message


async def get_event_by_uid(db: AsyncSession, event_uid: str) -> Event | None:
    stmt = select(Event).options(selectinload(Event.storage)).where(Event.event_uid == event_uid)
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_event_with_storage(
    db: AsyncSession, payload: EventCreateRequest, admin_id: int
) -> tuple[Event, bool, str]:
    event_uid = await _generate_unique_event_uid(db)
    bucket_name = await _generate_unique_bucket_name(db, payload.name)

    event = Event(
        event_uid=event_uid,
        name=payload.name,
        description=payload.description.strip() if payload.description else None,
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location.strip() if payload.location else None,
        organizer_name=payload.organizer_name.strip() if payload.organizer_name else None,
        organizer_contact=payload.organizer_contact.strip() if payload.organizer_contact else None,
        status=payload.status,
        accepting_photos=payload.accepting_photos,
        enforce_time_window=payload.enforce_time_window,
        access_code=None,
        created_by_id=admin_id,
    )
    db.add(event)
    await db.flush()

    storage = EventStorage(
        event_id=event.id,
        provider="cloudflare_r2",
        bucket_name=bucket_name,
        object_prefix=f"event-photos/{event_uid}",
        provisioning_status="pending",
        is_verified=False,
    )
    db.add(storage)
    await db.commit()

    loaded = await get_event_by_uid(db, event_uid)
    assert loaded is not None and loaded.storage is not None
    ok, msg = await _provision_storage_for_event(db, loaded, loaded.storage)
    refreshed = await get_event_by_uid(db, event_uid)
    assert refreshed is not None
    return refreshed, ok, msg


async def retry_event_storage_provisioning(db: AsyncSession, event: Event) -> tuple[Event, bool, str]:
    if not event.storage:
        bucket_name = await _generate_unique_bucket_name(db, event.name)
        storage = EventStorage(
            event_id=event.id,
            provider="cloudflare_r2",
            bucket_name=bucket_name,
            object_prefix=f"event-photos/{event.event_uid}",
            provisioning_status="pending",
            is_verified=False,
        )
        db.add(storage)
        await db.commit()
        await db.refresh(event, attribute_names=["storage"])

    assert event.storage is not None
    ok, msg = await _provision_storage_for_event(db, event, event.storage)
    refreshed = await get_event_by_uid(db, event.event_uid)
    assert refreshed is not None
    return refreshed, ok, msg


async def list_events(
    db: AsyncSession, search: str | None = None, status_filter: str | None = None
) -> list[Event]:
    stmt = select(Event).options(selectinload(Event.storage)).order_by(Event.created_at.desc())
    if status_filter and status_filter != "all":
        stmt = stmt.where(Event.status == status_filter)
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            Event.name.ilike(q)
            | Event.event_uid.ilike(q)
            | Event.location.ilike(q)
            | Event.access_code.ilike(q)
        )
    return list((await db.execute(stmt)).scalars().all())


async def update_event_details(db: AsyncSession, event: Event, payload: EventUpdateRequest) -> Event:
    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        if isinstance(val, str):
            val = val.strip() or None
        setattr(event, field, val)
    await db.commit()
    refreshed = await get_event_by_uid(db, event.event_uid)
    assert refreshed is not None
    return refreshed


async def update_event_status(
    db: AsyncSession, event: Event, payload: EventStatusUpdateRequest
) -> Event:
    event.status = payload.status
    if payload.accepting_photos is not None:
        event.accepting_photos = payload.accepting_photos
    await db.commit()
    refreshed = await get_event_by_uid(db, event.event_uid)
    assert refreshed is not None
    return refreshed


async def delete_event_and_storage(db: AsyncSession, event: Event) -> None:
    if event.storage and event.storage.provisioning_status == "provisioned":
        await r2_service.delete_bucket_and_contents(event.storage.bucket_name)
    await db.delete(event)
    await db.commit()


async def get_dashboard_stats(db: AsyncSession) -> DashboardStatsRead:
    total_events = (await db.execute(select(func.count(Event.id)))).scalar_one()
    active_events = (
        await db.execute(select(func.count(Event.id)).where(Event.status == "active"))
    ).scalar_one()
    completed_events = (
        await db.execute(select(func.count(Event.id)).where(Event.status == "completed"))
    ).scalar_one()
    inactive_events = (
        await db.execute(select(func.count(Event.id)).where(Event.status == "inactive"))
    ).scalar_one()
    archived_events = (
        await db.execute(select(func.count(Event.id)).where(Event.status == "archived"))
    ).scalar_one()

    total_photos_uploaded = (
        await db.execute(select(func.count(EventPhoto.id)).where(EventPhoto.upload_status == "uploaded"))
    ).scalar_one()
    total_storage_bytes = (
        await db.execute(
            select(func.coalesce(func.sum(EventPhoto.file_size), 0)).where(
                EventPhoto.upload_status == "uploaded"
            )
        )
    ).scalar_one()

    recent_stmt = select(Event).options(selectinload(Event.storage)).order_by(Event.created_at.desc()).limit(6)
    recent_events = [EventRead.model_validate(e) for e in (await db.execute(recent_stmt)).scalars().all()]

    return DashboardStatsRead(
        total_events=total_events,
        active_events=active_events,
        completed_events=completed_events,
        inactive_events=inactive_events,
        archived_events=archived_events,
        total_photos_uploaded=total_photos_uploaded,
        total_storage_bytes=int(total_storage_bytes or 0),
        recent_events=recent_events,
    )

