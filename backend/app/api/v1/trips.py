"""Trips (qatnovlar): scoped list — rows are produced by services.trips."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.quarry import Quarry
from app.models.region import District
from app.models.trip import Trip
from app.schemas.trip import TripOut

router = APIRouter(tags=["trips"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/trips", response_model=list[TripOut])
async def list_trips(
    db: DbDep,
    user: Annotated[object, Depends(get_current_user)],
    quarry_id: Annotated[UUID | None, Query()] = None,
    plate: Annotated[str | None, Query()] = None,
    trip_status: Annotated[str | None, Query(alias="status")] = None,
    kind: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Trip]:
    stmt = select(Trip).order_by(Trip.started_at.desc())

    # DB-level tenant scope — never trust the UI alone (mirrors /events).
    role = user.role  # type: ignore[attr-defined]
    if role == "operator":
        stmt = stmt.where(Trip.quarry_id == user.quarry_id)  # type: ignore[attr-defined]
    elif role == "department":
        stmt = (
            stmt.join(Quarry, Quarry.id == Trip.quarry_id)
            .join(District, District.id == Quarry.district_id)
            .where(District.region_id == user.region_id)  # type: ignore[attr-defined]
        )

    if quarry_id is not None:
        stmt = stmt.where(Trip.quarry_id == quarry_id)
    if plate:
        # `01S748HE` ko'rinishida ham, faqat raqam qismida ham izlash mumkin
        cleaned = plate.strip().upper().replace(" ", "")
        stmt = stmt.where((Trip.plate_region + Trip.plate_number) == cleaned)
    if trip_status is not None:
        stmt = stmt.where(Trip.status == trip_status)
    if kind is not None:
        stmt = stmt.where(Trip.kind == kind)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())
