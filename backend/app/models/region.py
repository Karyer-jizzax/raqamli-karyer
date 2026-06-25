"""Region (viloyat) and District (tuman) with optional PostGIS geometry."""

import uuid

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Region(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "regions"

    code: Mapped[str] = mapped_column(String(16), unique=True)
    name_uz_latn: Mapped[str] = mapped_column(String(64))
    name_uz_cyrl: Mapped[str] = mapped_column(String(64))
    name_ru: Mapped[str] = mapped_column(String(64))
    geom: Mapped[object | None] = mapped_column(
        Geometry("MULTIPOLYGON", srid=4326), nullable=True
    )

    districts: Mapped[list["District"]] = relationship(back_populates="region")


class District(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "districts"

    region_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regions.id"), index=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    name_uz_latn: Mapped[str] = mapped_column(String(64))
    name_uz_cyrl: Mapped[str] = mapped_column(String(64))
    name_ru: Mapped[str] = mapped_column(String(64))
    is_capital: Mapped[bool] = mapped_column(default=False)
    svg_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Label centroid in the demo SVG viewBox (for map badge placement).
    center_x: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    center_y: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    geom: Mapped[object | None] = mapped_column(
        Geometry("MULTIPOLYGON", srid=4326), nullable=True
    )

    region: Mapped[Region] = relationship(back_populates="districts")
