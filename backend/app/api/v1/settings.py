"""Runtime settings — trip rules tuned from web-main without a redeploy."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, require_role
from app.db.session import get_db
from app.services.app_settings import (
    TRIP_MIN_NETTO_KG,
    TRIP_OPEN_TIMEOUT_HOURS,
    get_int_setting,
    set_int_setting,
)

router = APIRouter(prefix="/settings", tags=["settings"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(require_role("superadmin"))]


class TripRules(BaseModel):
    # Netto below this (kg) → the trip is "no_cargo" (yuk emas).
    trip_min_netto_kg: int = Field(ge=0, le=100_000)
    # Main enter/exit unmatched longer than this (hours) → violation.
    trip_open_timeout_hours: int = Field(ge=1, le=168)


@router.get("/trip-rules", response_model=TripRules)
async def get_trip_rules(_user: CurrentUser, db: DbDep) -> TripRules:
    return TripRules(
        trip_min_netto_kg=await get_int_setting(db, TRIP_MIN_NETTO_KG),
        trip_open_timeout_hours=await get_int_setting(db, TRIP_OPEN_TIMEOUT_HOURS),
    )


@router.put("/trip-rules", response_model=TripRules)
async def update_trip_rules(body: TripRules, db: DbDep, _a: AdminDep) -> TripRules:
    """New values apply from now on — already stored trip statuses are not
    recomputed (the open-timeout rule IS read-time, so it follows instantly)."""
    await set_int_setting(db, TRIP_MIN_NETTO_KG, body.trip_min_netto_kg)
    await set_int_setting(db, TRIP_OPEN_TIMEOUT_HOURS, body.trip_open_timeout_hours)
    await db.commit()
    return body
