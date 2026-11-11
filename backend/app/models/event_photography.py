from datetime import date, datetime, time

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Sequence,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

event_photo_code_seq = Sequence("event_photo_code_seq", start=1, increment=1)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    sessions: Mapped[list["AdminSession"]] = relationship(
        back_populates="admin_user", cascade="all, delete-orphan"
    )


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    admin_user: Mapped["AdminUser"] = relationship(back_populates="sessions")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_uid: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    organizer_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    organizer_contact: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    accepting_photos: Mapped[bool] = mapped_column(Boolean, default=True)
    enforce_time_window: Mapped[bool] = mapped_column(Boolean, default=False)
    access_code: Mapped[str | None] = mapped_column(String(10), unique=True, index=True, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    storage: Mapped["EventStorage | None"] = relationship(
        back_populates="event", uselist=False, cascade="all, delete-orphan"
    )
    sessions: Mapped[list["EventSession"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    photos: Mapped[list["EventPhoto"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class EventStorage(Base):
    __tablename__ = "event_storage"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), default="cloudflare_r2")
    bucket_name: Mapped[str] = mapped_column(String(63), unique=True, index=True)
    object_prefix: Mapped[str] = mapped_column(String(255), default="")
    region: Mapped[str | None] = mapped_column(String(40), nullable=True)
    provisioning_status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_error: Mapped[Text | None] = mapped_column(Text, nullable=True)
    total_photos: Mapped[int] = mapped_column(Integer, default=0)
    total_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    event: Mapped["Event"] = relationship(back_populates="storage")


class EventSession(Base):
    __tablename__ = "event_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    session_token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    access_code_used: Mapped[str] = mapped_column(String(10))
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    photos_uploaded: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship(back_populates="sessions")
    photos: Mapped[list["EventPhoto"]] = relationship(back_populates="event_session")


class EventPhoto(Base):
    __tablename__ = "event_photos"
    __table_args__ = (Index("ix_event_photos_event_uploaded", "event_id", "uploaded_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    photo_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    event_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("event_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_access_code: Mapped[str] = mapped_column(String(10))
    bucket_name: Mapped[str] = mapped_column(String(63))
    object_key: Mapped[str] = mapped_column(String(512), unique=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stored_filename: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int] = mapped_column(BigInteger)
    mime_type: Mapped[str] = mapped_column(String(64))
    upload_status: Mapped[str] = mapped_column(String(30), default="uploaded", index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship(back_populates="photos")
    event_session: Mapped["EventSession | None"] = relationship(back_populates="photos")
    qr_code: Mapped["PhotoQRCode | None"] = relationship(
        back_populates="photo", uselist=False, cascade="all, delete-orphan"
    )


class PhotoQRCode(Base):
    __tablename__ = "photo_qr_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("event_photos.id", ondelete="CASCADE"), unique=True, index=True
    )
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    target_url: Mapped[str] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    scan_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    photo: Mapped["EventPhoto"] = relationship(back_populates="qr_code")

