"""event photography tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-11 17:21:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS event_photo_code_seq START WITH 1 INCREMENT BY 1"))

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_users_username", "admin_users", ["username"], unique=True)

    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("admin_user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["admin_user_id"], ["admin_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_sessions_admin_user_id", "admin_sessions", ["admin_user_id"], unique=False)
    op.create_index("ix_admin_sessions_token_hash", "admin_sessions", ["token_hash"], unique=True)

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_uid", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("organizer_name", sa.String(length=150), nullable=True),
        sa.Column("organizer_contact", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'active'")),
        sa.Column("accepting_photos", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("enforce_time_window", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("access_code", sa.String(length=10), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["admin_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_events_event_uid", "events", ["event_uid"], unique=True)
    op.create_index("ix_events_event_date", "events", ["event_date"], unique=False)
    op.create_index("ix_events_status", "events", ["status"], unique=False)
    op.create_index("ix_events_access_code", "events", ["access_code"], unique=True)
    op.create_index("ix_events_created_at", "events", ["created_at"], unique=False)

    op.create_table(
        "event_storage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False, server_default=sa.text("'cloudflare_r2'")),
        sa.Column("bucket_name", sa.String(length=63), nullable=False),
        sa.Column("object_prefix", sa.String(length=255), nullable=False, server_default=sa.text("''")),
        sa.Column("region", sa.String(length=40), nullable=True),
        sa.Column("provisioning_status", sa.String(length=30), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("total_photos", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_bytes", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_event_storage_event_id", "event_storage", ["event_id"], unique=True)
    op.create_index("ix_event_storage_bucket_name", "event_storage", ["bucket_name"], unique=True)
    op.create_index("ix_event_storage_provisioning_status", "event_storage", ["provisioning_status"], unique=False)

    op.create_table(
        "event_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("session_token", sa.String(length=128), nullable=False),
        sa.Column("access_code_used", sa.String(length=10), nullable=False),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("photos_uploaded", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_event_sessions_event_id", "event_sessions", ["event_id"], unique=False)
    op.create_index("ix_event_sessions_session_token", "event_sessions", ["session_token"], unique=True)

    op.create_table(
        "event_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("photo_code", sa.String(length=32), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("event_session_id", sa.Integer(), nullable=True),
        sa.Column("event_access_code", sa.String(length=10), nullable=False),
        sa.Column("bucket_name", sa.String(length=63), nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(length=64), nullable=False),
        sa.Column("upload_status", sa.String(length=30), nullable=False, server_default=sa.text("'uploaded'")),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_session_id"], ["event_sessions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_event_photos_photo_code", "event_photos", ["photo_code"], unique=True)
    op.create_index("ix_event_photos_event_id", "event_photos", ["event_id"], unique=False)
    op.create_index("ix_event_photos_event_session_id", "event_photos", ["event_session_id"], unique=False)
    op.create_index("ix_event_photos_object_key", "event_photos", ["object_key"], unique=True)
    op.create_index("ix_event_photos_upload_status", "event_photos", ["upload_status"], unique=False)
    op.create_index("ix_event_photos_uploaded_at", "event_photos", ["uploaded_at"], unique=False)
    op.create_index("ix_event_photos_event_uploaded", "event_photos", ["event_id", "uploaded_at"], unique=False)

    op.create_table(
        "photo_qr_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("photo_id", sa.Integer(), nullable=False),
        sa.Column("qr_token", sa.String(length=64), nullable=False),
        sa.Column("target_url", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("scan_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["photo_id"], ["event_photos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_photo_qr_codes_photo_id", "photo_qr_codes", ["photo_id"], unique=True)
    op.create_index("ix_photo_qr_codes_qr_token", "photo_qr_codes", ["qr_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_photo_qr_codes_qr_token", table_name="photo_qr_codes")
    op.drop_index("ix_photo_qr_codes_photo_id", table_name="photo_qr_codes")
    op.drop_table("photo_qr_codes")

    op.drop_index("ix_event_photos_event_uploaded", table_name="event_photos")
    op.drop_index("ix_event_photos_uploaded_at", table_name="event_photos")
    op.drop_index("ix_event_photos_upload_status", table_name="event_photos")
    op.drop_index("ix_event_photos_object_key", table_name="event_photos")
    op.drop_index("ix_event_photos_event_session_id", table_name="event_photos")
    op.drop_index("ix_event_photos_event_id", table_name="event_photos")
    op.drop_index("ix_event_photos_photo_code", table_name="event_photos")
    op.drop_table("event_photos")

    op.drop_index("ix_event_sessions_session_token", table_name="event_sessions")
    op.drop_index("ix_event_sessions_event_id", table_name="event_sessions")
    op.drop_table("event_sessions")

    op.drop_index("ix_event_storage_provisioning_status", table_name="event_storage")
    op.drop_index("ix_event_storage_bucket_name", table_name="event_storage")
    op.drop_index("ix_event_storage_event_id", table_name="event_storage")
    op.drop_table("event_storage")

    op.drop_index("ix_events_created_at", table_name="events")
    op.drop_index("ix_events_access_code", table_name="events")
    op.drop_index("ix_events_status", table_name="events")
    op.drop_index("ix_events_event_date", table_name="events")
    op.drop_index("ix_events_event_uid", table_name="events")
    op.drop_table("events")

    op.drop_index("ix_admin_sessions_token_hash", table_name="admin_sessions")
    op.drop_index("ix_admin_sessions_admin_user_id", table_name="admin_sessions")
    op.drop_table("admin_sessions")

    op.drop_index("ix_admin_users_username", table_name="admin_users")
    op.drop_table("admin_users")

    op.execute(sa.text("DROP SEQUENCE IF EXISTS event_photo_code_seq"))

