"""Measurement protocol (O'lchov bayonnomasi) — one official document per event."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

NORMATIVE_BASIS = (
    "O'zbekiston Respublikasi Soliq kodeksi va karyer materiallari hisobi to'g'risidagi "
    "normativ hujjatlar asosida. Ikki manbali (kamera + tarozi) o'lchov metodikasi."
)


class Protocol(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "protocols"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id"), unique=True, index=True
    )
    number: Mapped[str] = mapped_column(String(32), unique=True)  # KK-10022026-00001
    verification_code: Mapped[str] = mapped_column(String(32), unique=True)
    qr_payload: Mapped[str] = mapped_column(String(255))

    inspector_name: Mapped[str] = mapped_column(String(128), default="")
    operator_name: Mapped[str] = mapped_column(String(128), default="")
    driver_name: Mapped[str] = mapped_column(String(128), default="")
    normative_basis: Mapped[str] = mapped_column(Text, default=NORMATIVE_BASIS)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
