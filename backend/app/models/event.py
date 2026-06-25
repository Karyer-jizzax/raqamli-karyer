"""Event (hodisa) — a detected/registered transport with cargo measurement.

Mirrors the demo record shape. Volume fields are computed authoritatively by
`services.volume` on save (never trusted from the client).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Event(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "events"

    quarry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quarries.id"), index=True)
    post_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("posts.id"), nullable=True)
    camera_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cameras.id"), nullable=True)
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    material_id: Mapped[str | None] = mapped_column(ForeignKey("materials.id"), nullable=True)

    # vehicle snapshot
    plate_region: Mapped[str] = mapped_column(String(8))
    plate_number: Mapped[str] = mapped_column(String(16))
    model: Mapped[str] = mapped_column(String(64), default="")

    direction: Mapped[str] = mapped_column(String(8), default="exit")  # exit | enter
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    is_loaded: Mapped[bool] = mapped_column(Boolean, default=True)
    vtype: Mapped[str] = mapped_column(String(16), default="truck")
    payer_type: Mapped[str] = mapped_column(String(16), default="legal")

    # measurement inputs
    density: Mapped[float] = mapped_column(Numeric(6, 3), default=0)  # rho
    weight_kg: Mapped[int] = mapped_column(Integer, default=0)  # wkg
    length_m: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    width_m: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    height_m: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    tent_cover_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    # computed outputs (authoritative)
    volume_camera: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)  # Vc
    volume_scale: Mapped[float] = mapped_column(Numeric(10, 2), default=0)  # Vw
    volume_final: Mapped[float] = mapped_column(Numeric(10, 2), default=0)  # m3
    diff_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    volume_confidence: Mapped[float] = mapped_column(Numeric(5, 2), default=0)  # vc
    material_confidence: Mapped[float] = mapped_column(Numeric(5, 2), default=0)  # mc
    status: Mapped[str] = mapped_column(String(16), default="confirm", index=True)

    # owner snapshot
    owner_name: Mapped[str] = mapped_column(String(255), default="")
    stir: Mapped[str] = mapped_column(String(20), default="")
