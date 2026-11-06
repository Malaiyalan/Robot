from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user_service import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=list[UserRead])
async def list_users(skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
                     db: AsyncSession = Depends(get_db)):
    return await user_service.list(db, skip, limit)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    if await user_service.get_by_email(db, payload.email):
        raise HTTPException(409, "Email already registered")
    return await user_service.create(db, payload)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await user_service.get(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(user_id: int, payload: UserUpdate, db: AsyncSession = Depends(get_db)):
    user = await user_service.get(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return await user_service.update(db, user, payload)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await user_service.get(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    await user_service.delete(db, user)
