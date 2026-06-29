"""Stats endpoints for the department app (scope-aware)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.quarry import Camera, Post, Quarry
from app.models.region import District
from app.schemas.stats import (
    DynamicsResponse,
    M1Response,
    M1Row,
    Overview,
    ReportResponse,
    ReportRow,
)
from app.services import stats as stats_svc

router = APIRouter(prefix="/stats", tags=["stats"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[object, Depends(get_current_user)]


def _effective_region(user: object, region_id: UUID | None) -> UUID | None:
    """Department users are locked to their own region."""
    if user.role == "department":  # type: ignore[attr-defined]
        return user.region_id  # type: ignore[attr-defined]
    return region_id


@router.get("/overview", response_model=Overview)
async def overview(
    db: DbDep,
    user: UserDep,
    region_id: Annotated[UUID | None, Query()] = None,
    district_id: Annotated[UUID | None, Query()] = None,
) -> Overview:
    data = await stats_svc.overview(
        db, region_id=_effective_region(user, region_id), district_id=district_id
    )
    return Overview(**data)


@router.get("/dynamics", response_model=DynamicsResponse)
async def dynamics(
    db: DbDep,
    user: UserDep,
    year: Annotated[int | None, Query()] = None,
    region_id: Annotated[UUID | None, Query()] = None,
    district_id: Annotated[UUID | None, Query()] = None,
) -> DynamicsResponse:
    data = await stats_svc.dynamics(
        db,
        year=year or datetime.now().year,
        region_id=_effective_region(user, region_id),
        district_id=district_id,
    )
    return DynamicsResponse(**data)


# M2-M5: aggregate event breakdowns by a chosen dimension.
_REPORT_DIMS: dict[int, tuple[str, object]] = {
    2: ("material", Event.material_id),
    3: ("payer_type", Event.payer_type),
    5: ("status", Event.status),
}


@router.get("/reports/{n}", response_model=ReportResponse)
async def report(
    n: int,
    db: DbDep,
    user: UserDep,
    region_id: Annotated[UUID | None, Query()] = None,
) -> ReportResponse:
    if n not in (2, 3, 4, 5):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report topilmadi")
    eff_region = _effective_region(user, region_id)

    if n == 4:
        # By district (events -> quarry -> district)
        col = District.name_uz_latn
        stmt = (
            select(col, func.count(Event.id), func.coalesce(func.sum(Event.volume_final), 0))
            .join(Quarry, Quarry.id == Event.quarry_id)
            .join(District, District.id == Quarry.district_id)
        )
        if eff_region is not None:
            stmt = stmt.where(District.region_id == eff_region)
        stmt = stmt.group_by(col).order_by(func.count(Event.id).desc())
        dimension = "district"
    else:
        dimension, col = _REPORT_DIMS[n]
        stmt = select(col, func.count(Event.id), func.coalesce(func.sum(Event.volume_final), 0))
        if eff_region is not None:
            stmt = (
                stmt.join(Quarry, Quarry.id == Event.quarry_id)
                .join(District, District.id == Quarry.district_id)
                .where(District.region_id == eff_region)
            )
        stmt = stmt.group_by(col).order_by(func.count(Event.id).desc())

    rows = (await db.execute(stmt)).all()
    return ReportResponse(
        report=f"M{n}",
        dimension=dimension,
        rows=[
            ReportRow(key=str(r[0]) if r[0] is not None else "—", count=int(r[1]), volume=round(float(r[2]), 2))
            for r in rows
        ],
    )


@router.get("/m1", response_model=M1Response)
async def m1(
    db: DbDep,
    user: UserDep,
    region_id: Annotated[UUID | None, Query()] = None,
    district_id: Annotated[UUID | None, Query()] = None,
    quarry_id: Annotated[UUID | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    direction: Annotated[str | None, Query()] = None,
    payer_type: Annotated[str | None, Query()] = None,
    material_id: Annotated[str | None, Query()] = None,
    vtype: Annotated[str | None, Query()] = None,
    plate: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> M1Response:
    eff_region = _effective_region(user, region_id)

    base = select(Event)
    if district_id is not None or eff_region is not None:
        base = base.join(Quarry, Quarry.id == Event.quarry_id)
        if district_id is not None:
            base = base.where(Quarry.district_id == district_id)
        else:
            base = base.join(District, District.id == Quarry.district_id).where(
                District.region_id == eff_region
            )
    if quarry_id is not None:
        base = base.where(Event.quarry_id == quarry_id)
    if status:
        base = base.where(Event.status == status)
    if direction:
        base = base.where(Event.direction == direction)
    if payer_type:
        base = base.where(Event.payer_type == payer_type)
    if material_id:
        base = base.where(Event.material_id == material_id)
    if vtype:
        base = base.where(Event.vtype == vtype)
    if plate:
        base = base.where(Event.plate_number.ilike(f"%{plate}%"))

    # Totals over the full filtered set (reference the subquery's own columns,
    # not Event.*, otherwise the count cross-joins the full events table).
    subq = base.subquery()
    totals = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(subq.c.volume_final), 0)).select_from(
                subq
            )
        )
    ).one()

    # Rows: pull post code + camera label via null-safe joins on the event FKs.
    rows_stmt = (
        base.add_columns(Post.code, Camera.code, Camera.name)
        .outerjoin(Post, Post.id == Event.post_id)
        .outerjoin(Camera, Camera.id == Event.camera_id)
        .order_by(Event.occurred_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(rows_stmt)).all()
    return M1Response(
        rows=[
            M1Row(
                id=e.id,
                post_code=post_code,
                camera_label=cam_code or cam_name,
                plate_region=e.plate_region,
                plate_number=e.plate_number,
                model=e.model,
                vtype=e.vtype,
                direction=e.direction,
                occurred_at=e.occurred_at.isoformat(),
                is_loaded=e.is_loaded,
                material_id=e.material_id,
                weight_kg=e.weight_kg,
                density=float(e.density),
                volume_final=float(e.volume_final),
                volume_confidence=float(e.volume_confidence),
                material_confidence=float(e.material_confidence),
                payer_type=e.payer_type,
                stir=e.stir,
                owner_name=e.owner_name,
                status=e.status,
            )
            for e, post_code, cam_code, cam_name in rows
        ],
        total_count=int(totals[0]),
        total_volume=round(float(totals[1]), 2),
    )
