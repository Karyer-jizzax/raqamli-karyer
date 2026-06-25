"""Media (video frame / photo) captured for an event."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Media(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "media"

    # Nullable: a frame can be captured at /video/analyze before its event exists.
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), default="frame")  # frame | photo | video
    path: Mapped[str] = mapped_column(String(512))  # disk path
    url: Mapped[str] = mapped_column(String(512))  # served URL
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
