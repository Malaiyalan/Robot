from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import login_rate_limiter
from app.db.session import get_db
from app.models.event_photography import AdminSession, AdminUser
from app.schemas.event_photography import AdminLoginRequest, AdminLoginResponse, AdminUserRead
from app.services.admin_auth_service import (
    authenticate_admin,
    revoke_admin_session,
    validate_admin_token,
)

router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])
bearer_scheme = HTTPBearer(auto_error=False)


async def require_super_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> tuple[AdminUser, AdminSession]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required.",
        )
    result = await validate_admin_token(db, credentials.credentials)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session.",
        )
    return result


@router.post(
    "/login",
    response_model=AdminLoginResponse,
    dependencies=[Depends(login_rate_limiter)],
)
async def admin_login(payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    auth_res = await authenticate_admin(db, payload.username, payload.password)
    if not auth_res:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    raw_token, session, admin = auth_res
    return AdminLoginResponse(
        token=raw_token,
        expires_at=session.expires_at,
        admin=AdminUserRead.model_validate(admin),
    )


@router.post("/logout")
async def admin_logout(
    auth: tuple[AdminUser, AdminSession] = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    _, session = auth
    await revoke_admin_session(db, session)
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=AdminUserRead)
async def admin_me(auth: tuple[AdminUser, AdminSession] = Depends(require_super_admin)):
    admin, _ = auth
    return AdminUserRead.model_validate(admin)

