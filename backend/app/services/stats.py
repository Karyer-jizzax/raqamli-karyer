"""Dashboard / M1 / dynamics aggregation."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.organization import Organization
from app.models.quarry import Camera, Post, Quarry
from app.models.region import District


def _scoped_event_query(
    base: Select,
    *,
    region_id: UUID | None,
    district_id: UUID | None,
    quarry_id: UUID | None,
) -> Select:
    """Apply region/district/quarry scope to a query selecting from Event."""
    if quarry_id is not None:
        return base.where(Event.quarry_id == quarry_id)
    if district_id is not None:
        return base.join(Quarry, Quarry.id == Event.quarry_id).where(
            Quarry.district_id == district_id
        )
    if region_id is not None:
        return (
            base.join(Quarry, Quarry.id == Event.quarry_id)
            .join(District, District.id == Quarry.district_id)
            .where(District.region_id == region_id)
        )
    return base


async def overview(
    db: AsyncSession,
    *,
    region_id: UUID | None = None,
    district_id: UUID | None = None,
) -> dict:
    # Quarries / districts / cameras counts scoped to the region/district.
    q_stmt = select(func.count()).select_from(Quarry)
    d_stmt = select(func.count()).select_from(District)
    cam_stmt = (
        select(func.count())
        .select_from(Camera)
        .join(Post, Post.id == Camera.post_id)
        .join(Quarry, Quarry.id == Post.quarry_id)
    )
    if district_id is not None:
        q_stmt = q_stmt.where(Quarry.district_id == district_id)
        cam_stmt = cam_stmt.where(Quarry.district_id == district_id)
        d_stmt = d_stmt.where(District.id == district_id)
    elif region_id is not None:
        q_stmt = q_stmt.join(District, District.id == Quarry.district_id).where(
            District.region_id == region_id
        )
        cam_stmt = cam_stmt.join(District, District.id == Quarry.district_id).where(
            District.region_id == region_id
        )
        d_stmt = d_stmt.where(District.region_id == region_id)

    quarries = (await db.execute(q_stmt)).scalar() or 0
    districts = (await db.execute(d_stmt)).scalar() or 0
    cameras = (await db.execute(cam_stmt)).scalar() or 0
    organizations = (
        await db.execute(select(func.count()).select_from(Organization))
    ).scalar() or 0

    agg = _scoped_event_query(
        select(
            func.count(Event.id),
            func.coalesce(func.sum(Event.volume_final), 0),
            func.coalesce(func.avg(Event.volume_confidence), 0),
        ),
        region_id=region_id,
        district_id=district_id,
        quarry_id=None,
    )
    events, total_volume, avg_conf = (await db.execute(agg)).one()

    return {
        "quarries": quarries,
        "districts": districts,
        "cameras": cameras,
        "organizations": organizations,
        "events": events or 0,
        "total_volume": round(float(total_volume), 2),
        "avg_confidence": round(float(avg_conf), 2),
    }


async def dynamics(
    db: AsyncSession,
    *,
    year: int,
    region_id: UUID | None = None,
    district_id: UUID | None = None,
) -> dict:
    month = func.extract("month", Event.occurred_at)
    stmt = _scoped_event_query(
        select(
            month.label("m"),
            func.count(Event.id),
            func.count(Event.id).filter(Event.status == "confirm"),
        ),
        region_id=region_id,
        district_id=district_id,
        quarry_id=None,
    ).where(func.extract("year", Event.occurred_at) == year).group_by("m").order_by("m")

    rows = (await db.execute(stmt)).all()
    buckets = []
    total_events = 0
    pct_sum = 0.0
    for m, total, confirmed in rows:
        total = int(total)
        confirmed = int(confirmed)
        pct = round(confirmed / total * 100, 1) if total else 0.0
        buckets.append(
            {"month": int(m), "total": total, "confirmed": confirmed, "detection_pct": pct}
        )
        total_events += total
        pct_sum += pct
    avg_detection = round(pct_sum / len(buckets), 1) if buckets else 0.0
    return {
        "year": year,
        "buckets": buckets,
        "total_events": total_events,
        "avg_detection": avg_detection,
    }


def current_year() -> int:
    return datetime.now().year
