"""Trips (qatnovlar): scoped list — rows are produced by services.trips."""

from datetime import UTC, datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.quarry import Quarry
from app.models.region import District
from app.models.trip import Trip
from app.schemas.trip import TripOut
from app.schemas.waybill import WaybillDocument
from app.services.app_settings import TRIP_OPEN_TIMEOUT_HOURS, get_int_setting
from app.services.waybill import build_waybill, public_origin

router = APIRouter(tags=["trips"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

# Uzbekistan time — occurred_at values from /api/weigh carry this zone; a few
# manually created events may be naive, treat those as UZ local too.
_UZ_TZ = timezone(timedelta(hours=5))


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=_UZ_TZ)
    return dt


def _apply_open_timeout(trip: Trip, out: TripOut, cutoff: datetime) -> TripOut:
    """Read-side violation rule (no migration, no background job): a trip
    stuck at the factory scale — enter without exit, or exit without enter —
    beyond trip_open_timeout_hours (runtime-tunable from web-main) is shown
    as "incomplete" (huquqbuzarlik)."""
    if trip.status != "open":
        return out
    enter_at, exit_at = _aware(trip.main_enter_at), _aware(trip.main_exit_at)
    stuck_after_enter = (
        trip.main_enter_event_id is not None
        and trip.main_exit_event_id is None
        and enter_at is not None
        and enter_at < cutoff
    )
    stuck_after_exit = (
        trip.main_exit_event_id is not None
        and trip.main_enter_event_id is None
        and exit_at is not None
        and exit_at < cutoff
    )
    if stuck_after_enter or stuck_after_exit:
        out.status = "incomplete"
        out.stage = "chala"
    return out


@router.get("/trips", response_model=list[TripOut])
async def list_trips(
    db: DbDep,
    user: Annotated[object, Depends(get_current_user)],
    quarry_id: Annotated[UUID | None, Query()] = None,
    plate: Annotated[str | None, Query()] = None,
    trip_status: Annotated[str | None, Query(alias="status")] = None,
    kind: Annotated[str | None, Query()] = None,
    # Faqat zavod (tarozi) hodisasi bo'lgan qatnovlar — karyerda/yo'lda
    # turgan, hali zavodga yetmagan qatnovlar chiqarilmaydi.
    main_only: Annotated[bool, Query()] = False,
    limit: Annotated[int, Query(le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[TripOut]:
    stmt = select(Trip).order_by(Trip.started_at.desc())

    # DB-level tenant scope — never trust the UI alone (mirrors /events).
    role = user.role  # type: ignore[attr-defined]
    if role == "operator":
        stmt = stmt.where(Trip.quarry_id == user.quarry_id)  # type: ignore[attr-defined]
    elif role == "department":
        stmt = stmt.join(Quarry, Quarry.id == Trip.quarry_id)
        # Tuman hisobiga tuman, viloyat hisobiga viloyat (mirrors /events).
        if user.district_id is not None:  # type: ignore[attr-defined]
            stmt = stmt.where(Quarry.district_id == user.district_id)  # type: ignore[attr-defined]
        else:
            stmt = stmt.join(District, District.id == Quarry.district_id).where(
                District.region_id == user.region_id  # type: ignore[attr-defined]
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
    if main_only:
        stmt = stmt.where(
            (Trip.main_enter_event_id.is_not(None)) | (Trip.main_exit_event_id.is_not(None))
        )

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    timeout_hours = await get_int_setting(db, TRIP_OPEN_TIMEOUT_HOURS)
    cutoff = datetime.now(UTC) - timedelta(hours=timeout_hours)
    return [
        _apply_open_timeout(trip, TripOut.model_validate(trip), cutoff)
        for trip in result.scalars().all()
    ]


async def _in_scope(db: AsyncSession, user: object, trip: Trip) -> bool:
    """Same tenant rule the list applies, for a single trip fetched by id."""
    role = user.role  # type: ignore[attr-defined]
    if role == "operator":
        return trip.quarry_id == user.quarry_id  # type: ignore[attr-defined]
    if role == "department":
        row = (
            await db.execute(
                select(District.region_id, District.id)
                .join(Quarry, Quarry.district_id == District.id)
                .where(Quarry.id == trip.quarry_id)
            )
        ).first()
        if row is None:
            return False
        region_id, district_id = row
        if user.district_id is not None:  # type: ignore[attr-defined]
            return district_id == user.district_id  # type: ignore[attr-defined]
        return region_id == user.region_id  # type: ignore[attr-defined]
    return True


@router.get("/trips/{trip_id}/waybill", response_model=WaybillDocument)
async def trip_waybill(
    trip_id: UUID,
    db: DbDep,
    request: Request,
    user: Annotated[object, Depends(get_current_user)],
    # The printing app's own origin — the QR has to point back at it. Only
    # honoured if already trusted (see services.waybill.public_origin).
    public_base: Annotated[str | None, Query()] = None,
) -> WaybillDocument:
    """Yuk xati — the cargo document for one trip, with a QR to its public page."""
    trip = await db.get(Trip, trip_id)
    # A trip outside the caller's region must not be distinguishable from one
    # that does not exist, so both answer 404.
    if trip is None or not await _in_scope(db, user, trip):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Qatnov topilmadi")
    return await build_waybill(db, trip, public_origin(public_base, str(request.base_url)))
