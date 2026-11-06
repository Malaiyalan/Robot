from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Device(Base):
    """A physical robot. device_type: 'wedding_photo' | 'saree_tryon'."""
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    serial_number: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    device_type: Mapped[str] = mapped_column(String(40), default="wedding_photo")
    status: Mapped[str] = mapped_column(String(20), default="offline")  # online|offline|maintenance
    location: Mapped[str | None] = mapped_column(String(255))
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
