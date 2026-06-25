"""Quarry (karyer) + its posts and cameras."""

import uuid

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

# status: active | suspended
QUARRY_STATUSES = ("active", "suspended")
# camera kind: plate | volume
CAMERA_KINDS = ("plate", "volume")


class Quarry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quarries"

    district_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("districts.id"), index=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    location: Mapped[object | None] = mapped_column(
        Geometry("POINT", srid=4326), nullable=True
    )

    posts: Mapped[list["Post"]] = relationship(
        back_populates="quarry", cascade="all, delete-orphan"
    )


class Post(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "posts"

    quarry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quarries.id"), index=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))

    quarry: Mapped[Quarry] = relationship(back_populates="posts")
    cameras: Mapped[list["Camera"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )


class Camera(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "cameras"

    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id"), index=True)
    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(128))
    kind: Mapped[str] = mapped_column(String(16), default="plate")
    stream_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    post: Mapped[Post] = relationship(back_populates="cameras")
