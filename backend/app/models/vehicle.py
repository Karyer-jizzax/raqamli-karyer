"""Vehicle (avtotransport) — optional dedup of plate/model."""

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Vehicle(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "vehicles"
    __table_args__ = (
        UniqueConstraint("plate_region", "plate_number", name="uq_vehicles_plate"),
    )

    plate_region: Mapped[str] = mapped_column(String(8))
    plate_number: Mapped[str] = mapped_column(String(16))
    model: Mapped[str] = mapped_column(String(64), default="")
    vtype: Mapped[str] = mapped_column(String(16), default="truck")
