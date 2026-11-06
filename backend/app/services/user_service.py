from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.crud_base import CRUDBase


class UserService(CRUDBase[User, UserCreate, UserUpdate]):
    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, obj_in: UserCreate) -> User:
        user = User(
            email=obj_in.email,
            full_name=obj_in.full_name,
            hashed_password=hash_password(obj_in.password),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def update(self, db: AsyncSession, obj: User, obj_in: UserUpdate) -> User:
        data = obj_in.model_dump(exclude_unset=True)
        pwd = data.pop("password", None)
        if pwd:
            obj.hashed_password = hash_password(pwd)
        for field, value in data.items():
            setattr(obj, field, value)
        await db.commit()
        await db.refresh(obj)
        return obj


user_service = UserService(User)
