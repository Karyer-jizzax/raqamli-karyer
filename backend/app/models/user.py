"""Application user with role + tenant scope."""

import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# role: superadmin | department | operator
ROLES = ("superadmin", "department", "operator")


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(128), default="")
    role: Mapped[str] = mapped_column(String(16), default="operator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Tenant scope — operator bound to a quarry, department to a region.
    quarry_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("quarries.id"), nullable=True
    )
    region_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("regions.id"), nullable=True
    )
