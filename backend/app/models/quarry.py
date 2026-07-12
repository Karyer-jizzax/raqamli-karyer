"""Quarry (karyer) + its posts and cameras."""

import uuid

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Column, ForeignKey, String, Table, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

# status: active | suspended
QUARRY_STATUSES = ("active", "suspended")
# camera kind: plate (ANPR) | record (evidentiary video, no detection)
CAMERA_KINDS = ("plate", "record")
# camera vendor — decides the ANPR/RTSP protocol the local server uses
CAMERA_BRANDS = ("dahua", "hikvision")

# Which materials (products) a quarry produces/handles — plain many-to-many.
quarry_materials = Table(
    "quarry_materials",
    Base.metadata,
    Column("quarry_id", Uuid, ForeignKey("quarries.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "material_id", String(32), ForeignKey("materials.id", ondelete="CASCADE"), primary_key=True
    ),
)


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
    # Local-server ingest key (X-API-Key on /api/weigh). Generated on first
    # provision-token issue; NULL until the quarry is provisioned.
    api_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
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
    brand: Mapped[str] = mapped_column(String(16), default="dahua")
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    login: Mapped[str | None] = mapped_column(String(64), nullable=True)
    password: Mapped[str | None] = mapped_column(String(128), nullable=True)

    post: Mapped[Post] = relationship(back_populates="cameras")
