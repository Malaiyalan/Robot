from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")
CreateT = TypeVar("CreateT", bound=BaseModel)
UpdateT = TypeVar("UpdateT", bound=BaseModel)


class CRUDBase(Generic[ModelT, CreateT, UpdateT]):
    """Reusable async CRUD. Subclass to add business logic."""

    def __init__(self, model: type[ModelT]):
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> ModelT | None:
        return await db.get(self.model, id)

    async def list(self, db: AsyncSession, skip: int = 0, limit: int = 50) -> list[ModelT]:
        result = await db.execute(select(self.model).order_by(self.model.id).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, obj_in: CreateT) -> ModelT:
        obj = self.model(**obj_in.model_dump())
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def update(self, db: AsyncSession, obj: ModelT, obj_in: UpdateT) -> ModelT:
        data: dict[str, Any] = obj_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(obj, field, value)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def delete(self, db: AsyncSession, obj: ModelT) -> None:
        await db.delete(obj)
        await db.commit()
