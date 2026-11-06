from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Saree(Base):
    """Saree try-on robot: catalog item."""
    __tablename__ = "sarees"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    color: Mapped[str | None] = mapped_column(String(50))
    fabric: Mapped[str | None] = mapped_column(String(80))
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_available: Mapped[bool] = mapped_column(default=True)
