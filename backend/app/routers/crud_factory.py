from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db


def build_crud_router(*, prefix: str, tag: str, service, Create, Update, Read) -> APIRouter:
    """Generates list / get / create / update / delete endpoints for a resource."""
    router = APIRouter(prefix=prefix, tags=[tag])

    @router.get("/", response_model=list[Read])
    async def list_items(
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
        db: AsyncSession = Depends(get_db),
    ):
        return await service.list(db, skip, limit)

    @router.post("/", response_model=Read, status_code=status.HTTP_201_CREATED)
    async def create_item(payload: Create, db: AsyncSession = Depends(get_db)):
        return await service.create(db, payload)

    @router.get("/{item_id}", response_model=Read)
    async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
        obj = await service.get(db, item_id)
        if not obj:
            raise HTTPException(404, f"{tag} not found")
        return obj

    @router.patch("/{item_id}", response_model=Read)
    async def update_item(item_id: int, payload: Update, db: AsyncSession = Depends(get_db)):
        obj = await service.get(db, item_id)
        if not obj:
            raise HTTPException(404, f"{tag} not found")
        return await service.update(db, obj, payload)

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
        obj = await service.get(db, item_id)
        if not obj:
            raise HTTPException(404, f"{tag} not found")
        await service.delete(db, obj)

    return router
