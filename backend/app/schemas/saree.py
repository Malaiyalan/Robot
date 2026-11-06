from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SareeCreate(BaseModel):
    name: str
    color: str | None = None
    fabric: str | None = None
    price: Decimal | None = None
    image_url: str | None = None
    is_available: bool = True


class SareeUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    fabric: str | None = None
    price: Decimal | None = None
    image_url: str | None = None
    is_available: bool | None = None


class SareeRead(SareeCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
