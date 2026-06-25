"""Material type with density range (carried over from the demo MATS array)."""

from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Material(Base, TimestampMixin):
    __tablename__ = "materials"

    # slug id: shagal / qumshagal / qurilishqum / tosh / ohak / tent
    id: Mapped[str] = mapped_column(String(32), primary_key=True)

    default_density: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    density_min: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    density_max: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    is_tent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    name_uz_latn: Mapped[str] = mapped_column(String(64), nullable=False)
    name_uz_cyrl: Mapped[str] = mapped_column(String(64), nullable=False)
    name_ru: Mapped[str] = mapped_column(String(64), nullable=False)
