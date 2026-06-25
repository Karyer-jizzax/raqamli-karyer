"""Organization / owner (egasi) — legal entity, individual, or YaTT."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# payer_type: legal | indiv | yatt
PAYER_TYPES = ("legal", "indiv", "yatt")


class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"

    stir: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    payer_type: Mapped[str] = mapped_column(String(16), default="legal")
