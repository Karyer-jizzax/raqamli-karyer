"""Runtime-tunable settings (app_settings table) with env-config fallbacks.

Superadmin edits these from web-main; core.config values act as defaults
until a row exists. Keys are whitelisted here so a typo can't create a
dangling setting.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.app_setting import AppSetting

# key -> env-config default (also serves as the whitelist)
TRIP_MIN_NETTO_KG = "trip_min_netto_kg"
TRIP_OPEN_TIMEOUT_HOURS = "trip_open_timeout_hours"


def _default(key: str) -> int:
    return int(getattr(settings, key))


async def get_int_setting(db: AsyncSession, key: str) -> int:
    """The stored value, or the env-config default if never overridden."""
    row = await db.get(AppSetting, key)
    if row is None:
        return _default(key)
    try:
        return int(row.value)
    except ValueError:  # corrupted by hand — fall back rather than crash ingest
        return _default(key)


async def set_int_setting(db: AsyncSession, key: str, value: int) -> None:
    """Upsert on the session without committing — the caller owns the transaction."""
    row = await db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=str(value)))
    else:
        row.value = str(value)
