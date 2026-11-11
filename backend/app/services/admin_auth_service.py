from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import generate_session_token, hash_password, hash_token, verify_password
from app.models.event_photography import AdminSession, AdminUser


async def ensure_initial_super_admin(db: AsyncSession) -> None:
    """Seed the single Super Admin account from environment config if none exists."""
    count = (await db.execute(select(func.count(AdminUser.id)))).scalar_one()
    if count > 0:
        return
    admin = AdminUser(
        username=settings.SUPER_ADMIN_USERNAME,
        hashed_password=hash_password(settings.SUPER_ADMIN_PASSWORD),
        is_active=True,
    )
    db.add(admin)
    await db.commit()


async def authenticate_admin(
    db: AsyncSession, username: str, password: str
) -> tuple[str, AdminSession, AdminUser] | None:
    stmt = select(AdminUser).where(AdminUser.username == username.strip())
    admin = (await db.execute(stmt)).scalar_one_or_none()
    if not admin or not admin.is_active:
        return None
    if not verify_password(password, admin.hashed_password):
        return None

    raw_token = generate_session_token()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.ADMIN_SESSION_HOURS)
    session = AdminSession(
        admin_user_id=admin.id,
        token_hash=hash_token(raw_token),
        expires_at=expires_at,
    )
    admin.last_login_at = now
    db.add(session)
    await db.commit()
    await db.refresh(session)
    await db.refresh(admin)
    return raw_token, session, admin


async def validate_admin_token(
    db: AsyncSession, raw_token: str
) -> tuple[AdminUser, AdminSession] | None:
    if not raw_token:
        return None
    now = datetime.now(timezone.utc)
    stmt = (
        select(AdminSession, AdminUser)
        .join(AdminUser, AdminSession.admin_user_id == AdminUser.id)
        .where(
            AdminSession.token_hash == hash_token(raw_token),
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
            AdminUser.is_active.is_(True),
        )
    )
    row = (await db.execute(stmt)).first()
    if not row:
        return None
    session, admin = row
    return admin, session


async def revoke_admin_session(db: AsyncSession, session: AdminSession) -> None:
    session.revoked_at = datetime.now(timezone.utc)
    await db.commit()

