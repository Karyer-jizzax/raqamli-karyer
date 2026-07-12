"""AppSetting — runtime-tunable key/value settings (web-main, superadmin).

Values here override the env-based defaults in core.config for the settings
that operators need to tune without a redeploy (trip rules etc.). Read through
services.app_settings — never query this table ad-hoc.
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AppSetting(Base, TimestampMixin):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255))
