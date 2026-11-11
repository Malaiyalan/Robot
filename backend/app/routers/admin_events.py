from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import sign_media_params, verify_media_signature
from app.db.session import get_db
from app.models.event_photography import AdminSession, AdminUser, Event, EventPhoto
from app.routers.admin_auth import bearer_scheme, require_super_admin
from app.schemas.event_photography import (
    AdminPhotoListResponse,
    AdminPhotoRead,
    AdminPhotoUpdateRequest,
    DashboardStatsRead,
    EventCreateRequest,
    EventProvisionResponse,
    EventRead,
    EventStatusUpdateRequest,
    EventUpdateRequest,
)
from app.services.admin_auth_service import validate_admin_token
from app.services.event_service import (
    create_event_with_storage,
    delete_event_and_storage,
    get_dashboard_stats,
    get_event_by_uid,
    list_events,
    retry_event_storage_provisioning,
    update_event_details,
    update_event_status,
)
from app.services.photo_workflow_service import delete_photo_and_r2_object
from app.services.qr_service import generate_qr_png_bytes, generate_qr_svg_bytes
from app.services.r2_service import R2StorageError, r2_service

router = APIRouter(prefix="/admin", tags=["Admin Events & Photos"])


def _build_admin_photo_read(photo: EventPhoto) -> AdminPhotoRead:
    exp = int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp())
    sig = sign_media_params(photo.photo_code, exp, settings.SESSION_SECRET_KEY)
    prefix = settings.API_V1_PREFIX
    base_img = f"{prefix}/admin/photos/{photo.photo_code}/image?exp={exp}&sig={sig}"
    qr_url = f"{prefix}/admin/photos/{photo.photo_code}/qr?exp={exp}&sig={sig}"

    return AdminPhotoRead(
        photo_id=photo.photo_code,
        event_uid=photo.event.event_uid,
        event_name=photo.event.name,
        event_access_code=photo.event_access_code,
        bucket_name=photo.bucket_name,
        object_key=photo.object_key,
        original_filename=photo.original_filename,
        stored_filename=photo.stored_filename,
        file_size=photo.file_size,
        mime_type=photo.mime_type,
        upload_status=photo.upload_status,
        is_public=photo.is_public,
        uploaded_at=photo.uploaded_at,
        image_url=base_img,
        download_url=f"{base_img}&download=1",
        qr_target_url=photo.qr_code.target_url if photo.qr_code else None,
        qr_image_url=qr_url,
        scan_count=photo.qr_code.scan_count if photo.qr_code else 0,
    )


async def _authorize_admin_media(
    photo_code: str,
    exp: int | None,
    sig: str | None,
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> None:
    if exp is not None and sig is not None:
        if verify_media_signature(photo_code, exp, sig, settings.SESSION_SECRET_KEY):
            return
    if credentials and credentials.scheme.lower() == "bearer":
        res = await validate_admin_token(db, credentials.credentials)
        if res:
            return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required.")


@router.get("/dashboard", response_model=DashboardStatsRead)
async def admin_dashboard(
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    return await get_dashboard_stats(db)


@router.get("/events", response_model=list[EventRead])
async def admin_list_events(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    events = await list_events(db, search=search, status_filter=status_filter)
    return [EventRead.model_validate(e) for e in events]


@router.post("/events", response_model=EventProvisionResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_event(
    payload: EventCreateRequest,
    auth: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    admin, _ = auth
    event, provisioned, msg = await create_event_with_storage(db, payload, admin.id)
    return EventProvisionResponse(
        event=EventRead.model_validate(event),
        provisioned=provisioned,
        message=msg,
    )


@router.get("/events/{event_uid}", response_model=EventRead)
async def admin_get_event(
    event_uid: str,
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await get_event_by_uid(db, event_uid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    return EventRead.model_validate(event)


@router.patch("/events/{event_uid}", response_model=EventRead)
async def admin_update_event(
    event_uid: str,
    payload: EventUpdateRequest,
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await get_event_by_uid(db, event_uid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    updated = await update_event_details(db, event, payload)
    return EventRead.model_validate(updated)


@router.patch("/events/{event_uid}/status", response_model=EventRead)
async def admin_update_event_status(
    event_uid: str,
    payload: EventStatusUpdateRequest,
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await get_event_by_uid(db, event_uid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    updated = await update_event_status(db, event, payload)
    return EventRead.model_validate(updated)


@router.post("/events/{event_uid}/provision-storage", response_model=EventProvisionResponse)
async def admin_retry_storage_provisioning(
    event_uid: str,
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await get_event_by_uid(db, event_uid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    updated, ok, msg = await retry_event_storage_provisioning(db, event)
    return EventProvisionResponse(
        event=EventRead.model_validate(updated),
        provisioned=ok,
        message=msg,
    )


@router.post("/events/{event_uid}/archive", response_model=EventRead)
async def admin_archive_event(
    event_uid: str,
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await get_event_by_uid(db, event_uid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    updated = await update_event_status(
        db, event, EventStatusUpdateRequest(status="archived", accepting_photos=False)
    )
    return EventRead.model_validate(updated)


@router.delete("/events/{event_uid}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_event(
    event_uid: str,
    confirm: bool = Query(default=False),
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    if not confirm:
        raise HTTPException(status_code=400, detail="Explicit confirmation (?confirm=true) is required to delete an event.")
    event = await get_event_by_uid(db, event_uid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    try:
        await delete_event_and_storage(db, event)
    except R2StorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/events/{event_uid}/photos", response_model=AdminPhotoListResponse)
async def admin_list_event_photos(
    event_uid: str,
    search: str | None = Query(default=None),
    mime_type: str | None = Query(default=None),
    uploaded_date: date | None = Query(default=None),
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await get_event_by_uid(db, event_uid)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    stmt = (
        select(EventPhoto)
        .options(selectinload(EventPhoto.event), selectinload(EventPhoto.qr_code))
        .where(EventPhoto.event_id == event.id, EventPhoto.upload_status == "uploaded")
        .order_by(EventPhoto.uploaded_at.desc())
    )
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            EventPhoto.photo_code.ilike(q)
            | EventPhoto.original_filename.ilike(q)
            | EventPhoto.stored_filename.ilike(q)
        )
    if mime_type and mime_type != "all":
        stmt = stmt.where(EventPhoto.mime_type == mime_type)

    photos = list((await db.execute(stmt)).scalars().all())
    if uploaded_date:
        photos = [p for p in photos if p.uploaded_at.astimezone(timezone.utc).date() == uploaded_date]

    items = [_build_admin_photo_read(p) for p in photos]
    total_bytes = sum(p.file_size for p in photos)
    return AdminPhotoListResponse(items=items, total=len(items), total_bytes=total_bytes)


@router.get("/photos/{photo_code}/image")
async def admin_stream_photo(
    photo_code: str,
    download: bool = Query(default=False),
    exp: int | None = Query(default=None),
    sig: str | None = Query(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    normalized = photo_code.strip().upper()
    await _authorize_admin_media(normalized, exp, sig, credentials, db)

    stmt = select(EventPhoto).where(EventPhoto.photo_code == normalized)
    photo = (await db.execute(stmt)).scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photograph not found.")

    try:
        obj = await r2_service.get_photo(photo.bucket_name, photo.object_key)
    except R2StorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    headers = {"Cache-Control": "private, max-age=300"}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{photo.stored_filename}"'
    return Response(content=obj.body, media_type=photo.mime_type, headers=headers)


@router.get("/photos/{photo_code}/qr")
async def admin_photo_qr(
    photo_code: str,
    format: str = Query(default="png", pattern="^(png|svg)$"),
    download: bool = Query(default=False),
    exp: int | None = Query(default=None),
    sig: str | None = Query(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    normalized = photo_code.strip().upper()
    await _authorize_admin_media(normalized, exp, sig, credentials, db)

    stmt = (
        select(EventPhoto)
        .options(selectinload(EventPhoto.qr_code))
        .where(EventPhoto.photo_code == normalized)
    )
    photo = (await db.execute(stmt)).scalar_one_or_none()
    if not photo or not photo.qr_code:
        raise HTTPException(status_code=404, detail="QR code not found.")

    target_url = photo.qr_code.target_url
    headers = {"Cache-Control": "private, max-age=300"}
    if format == "svg":
        content = generate_qr_svg_bytes(target_url)
        if download:
            headers["Content-Disposition"] = f'attachment; filename="{normalized}-qr.svg"'
        return Response(content=content, media_type="image/svg+xml", headers=headers)

    content = generate_qr_png_bytes(target_url)
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{normalized}-qr.png"'
    return Response(content=content, media_type="image/png", headers=headers)


@router.patch("/photos/{photo_code}", response_model=AdminPhotoRead)
async def admin_update_photo(
    photo_code: str,
    payload: AdminPhotoUpdateRequest,
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    normalized = photo_code.strip().upper()
    stmt = (
        select(EventPhoto)
        .options(selectinload(EventPhoto.event), selectinload(EventPhoto.qr_code))
        .where(EventPhoto.photo_code == normalized)
    )
    photo = (await db.execute(stmt)).scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photograph not found.")
    photo.is_public = payload.is_public
    await db.commit()
    await db.refresh(photo)
    return _build_admin_photo_read(photo)


@router.delete("/photos/{photo_code}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_photo(
    photo_code: str,
    _: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    normalized = photo_code.strip().upper()
    stmt = (
        select(EventPhoto)
        .options(selectinload(EventPhoto.event).selectinload(Event.storage))
        .where(EventPhoto.photo_code == normalized)
    )
    photo = (await db.execute(stmt)).scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photograph not found.")
    try:
        await delete_photo_and_r2_object(db, photo)
    except R2StorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
