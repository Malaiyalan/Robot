from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import access_code_rate_limiter, upload_rate_limiter
from app.db.session import get_db
from app.models.event_photography import EventPhoto
from app.schemas.event_photography import (
    EventAccessRequest,
    EventAccessResponse,
    PublicEventInfo,
    PublicPhotoUploadResponse,
    PublicPhotoViewResponse,
    PublicSessionPhotoItem,
    PublicSessionStatusResponse,
)
from app.services.photo_workflow_service import (
    create_event_session_by_code,
    get_public_photo_by_code,
    upload_photo_for_session,
    validate_event_session_token,
)
from app.services.qr_service import generate_qr_png_bytes, generate_qr_svg_bytes
from app.services.r2_service import R2StorageError, r2_service

router = APIRouter(prefix="/public", tags=["Public Event Photography"])
session_bearer = HTTPBearer(auto_error=False)


def _resolve_public_app_url(request: Request) -> str:
    origin = request.headers.get("origin")
    if origin:
        parsed = urlparse(origin.strip())
        if parsed.scheme in ("http", "https") and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return settings.PUBLIC_APP_URL


def _extract_event_session_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    header_token = request.headers.get("x-event-session")
    if header_token and header_token.strip():
        return header_token.strip()
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Event session token is missing.")


@router.post(
    "/events/access",
    response_model=EventAccessResponse,
    dependencies=[Depends(access_code_rate_limiter)],
)
async def access_event_by_code(
    payload: EventAccessRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    forwarded = request.headers.get("x-forwarded-for")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent")
    token, session, event = await create_event_session_by_code(
        db,
        payload.access_code,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return EventAccessResponse(
        session_token=token,
        expires_at=session.expires_at,
        event=PublicEventInfo(
            event_name=event.name,
            event_date=event.event_date,
            location=event.location,
            description=event.description,
        ),
    )


@router.get("/session", response_model=PublicSessionStatusResponse)
async def check_event_session(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(session_bearer),
    db: AsyncSession = Depends(get_db),
):
    token = _extract_event_session_token(request, credentials)
    session, event = await validate_event_session_token(db, token)
    return PublicSessionStatusResponse(
        valid=True,
        expires_at=session.expires_at,
        photos_uploaded=session.photos_uploaded,
        event=PublicEventInfo(
            event_name=event.name,
            event_date=event.event_date,
            location=event.location,
            description=event.description,
        ),
    )


@router.get("/session/photos", response_model=list[PublicSessionPhotoItem])
async def list_current_session_photos(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(session_bearer),
    db: AsyncSession = Depends(get_db),
):
    token = _extract_event_session_token(request, credentials)
    session, _ = await validate_event_session_token(db, token)
    stmt = (
        select(EventPhoto)
        .where(
            EventPhoto.event_session_id == session.id,
            EventPhoto.upload_status == "uploaded",
            EventPhoto.is_public.is_(True),
        )
        .order_by(EventPhoto.uploaded_at.desc())
    )
    photos = list((await db.execute(stmt)).scalars().all())
    prefix = settings.API_V1_PREFIX
    public_base = _resolve_public_app_url(request)
    return [
        PublicSessionPhotoItem(
            photo_id=p.photo_code,
            mime_type=p.mime_type,
            file_size=p.file_size,
            uploaded_at=p.uploaded_at,
            photo_view_url=f"{prefix}/public/photos/{p.photo_code}",
            qr_target_url=f"{public_base}/photos/{p.photo_code}",
            qr_image_url=f"{prefix}/public/photos/{p.photo_code}/qr",
        )
        for p in photos
    ]


@router.post(
    "/photos/upload",
    response_model=PublicPhotoUploadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(upload_rate_limiter)],
)
async def upload_event_photo(
    request: Request,
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials | None = Depends(session_bearer),
    db: AsyncSession = Depends(get_db),
):
    token = _extract_event_session_token(request, credentials)
    session, event = await validate_event_session_token(db, token)

    # Read up to max_upload_bytes + 1 so oversized payloads fail early without OOM
    limit = settings.max_upload_bytes
    chunks: list[bytes] = []
    total_read = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
            )
        chunks.append(chunk)
    file_bytes = b"".join(chunks)

    public_base = _resolve_public_app_url(request)
    photo, qr, qr_data_url = await upload_photo_for_session(
        db=db,
        session=session,
        event=event,
        file_bytes=file_bytes,
        original_filename=file.filename,
        public_app_base_url=public_base,
    )
    prefix = settings.API_V1_PREFIX
    return PublicPhotoUploadResponse(
        photo_id=photo.photo_code,
        event_name=event.name,
        mime_type=photo.mime_type,
        file_size=photo.file_size,
        uploaded_at=photo.uploaded_at,
        photo_view_url=f"/photos/{photo.photo_code}",
        qr_target_url=qr.target_url,
        qr_image_url=f"{prefix}/public/photos/{photo.photo_code}/qr",
        qr_data_url=qr_data_url,
    )


@router.get("/photos/{photo_code}", response_model=PublicPhotoViewResponse)
async def get_public_photo_metadata(photo_code: str, db: AsyncSession = Depends(get_db)):
    photo = await get_public_photo_by_code(db, photo_code)
    if photo.qr_code:
        photo.qr_code.scan_count += 1
        await db.commit()
    prefix = settings.API_V1_PREFIX
    return PublicPhotoViewResponse(
        photo_id=photo.photo_code,
        event_name=photo.event.name,
        event_date=photo.event.event_date,
        mime_type=photo.mime_type,
        file_size=photo.file_size,
        uploaded_at=photo.uploaded_at,
        image_url=f"{prefix}/public/photos/{photo.photo_code}/image",
        download_url=f"{prefix}/public/photos/{photo.photo_code}/image?download=1",
        download_enabled=True,
    )


@router.get("/photos/{photo_code}/image")
async def stream_public_photo_image(
    photo_code: str,
    download: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    photo = await get_public_photo_by_code(db, photo_code)
    try:
        obj = await r2_service.get_photo(photo.bucket_name, photo.object_key)
    except R2StorageError as exc:
        if exc.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail="Sorry, this photograph is currently unavailable.",
            ) from exc
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    headers = {"Cache-Control": "private, max-age=300"}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{photo.stored_filename}"'
    return Response(content=obj.body, media_type=photo.mime_type, headers=headers)


@router.get("/photos/{photo_code}/qr")
async def get_public_photo_qr(
    photo_code: str,
    format: str = Query(default="png", pattern="^(png|svg)$"),
    download: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    photo = await get_public_photo_by_code(db, photo_code)
    if not photo.qr_code:
        raise HTTPException(status_code=404, detail="Sorry, this photograph is currently unavailable.")

    headers = {"Cache-Control": "private, max-age=300"}
    if format == "svg":
        content = generate_qr_svg_bytes(photo.qr_code.target_url)
        if download:
            headers["Content-Disposition"] = f'attachment; filename="{photo.photo_code}-qr.svg"'
        return Response(content=content, media_type="image/svg+xml", headers=headers)

    content = generate_qr_png_bytes(photo.qr_code.target_url)
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{photo.photo_code}-qr.png"'
    return Response(content=content, media_type="image/png", headers=headers)

