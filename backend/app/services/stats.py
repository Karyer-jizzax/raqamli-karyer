"""Dashboard / M1 / dynamics aggregation."""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import ColumnElement, Select, and_, func, select
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
    year: int | None = None,
    month: int | None = None,
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

    cam_active_stmt = cam_stmt.where(Camera.is_active)

    quarries = (await db.execute(q_stmt)).scalar() or 0
    districts = (await db.execute(d_stmt)).scalar() or 0
    cameras = (await db.execute(cam_stmt)).scalar() or 0
    cameras_active = (await db.execute(cam_active_stmt)).scalar() or 0
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
    # Event-derived metrics are scoped to the selected period; infrastructure
    # counts (quarries/districts/cameras) are time-independent.
    if year is not None:
        agg = agg.where(func.extract("year", Event.occurred_at) == year)
    if month is not None:
        agg = agg.where(func.extract("month", Event.occurred_at) == month)
    events, total_volume, avg_conf = (await db.execute(agg)).one()

    return {
        "quarries": quarries,
        "districts": districts,
        "cameras": cameras,
        "cameras_active": cameras_active,
        "cameras_inactive": cameras - cameras_active,
        "organizations": organizations,
        "events": events or 0,
        "total_volume": round(float(total_volume), 2),
        "avg_confidence": round(float(avg_conf), 2),
    }


def _period_conds(date_from: date | None, date_to: date | None) -> list[ColumnElement[bool]]:
    """Inclusive [date_from, date_to] filter on Event.occurred_at."""
    conds: list[ColumnElement[bool]] = []
    if date_from is not None:
        conds.append(Event.occurred_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to is not None:
        conds.append(
            Event.occurred_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        )
    return conds


# Distinct-plate key; empty plate_number (unrecognized) is excluded via FILTER.
_PLATE = Event.plate_region + Event.plate_number

# Shared aggregate columns for cargo stats (events / trucks / volume / ...).
_CARGO_AGGS = (
    func.count(Event.id).label("events"),
    func.count(func.distinct(_PLATE)).filter(Event.plate_number != "").label("trucks"),
    func.coalesce(func.sum(Event.volume_final), 0).label("volume"),
    func.count(Event.id).filter(Event.plate_number == "").label("unidentified"),
    func.max(Event.occurred_at).label("last_event_at"),
)


async def quarry_stats(
    db: AsyncSession,
    *,
    quarry_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """Per-quarry dashboard numbers (QuarryDetail page)."""
    ev_stmt = select(*_CARGO_AGGS).where(
        Event.quarry_id == quarry_id, *_period_conds(date_from, date_to)
    )
    events, trucks, volume, unidentified, last_at = (await db.execute(ev_stmt)).one()

    cam_stmt = (
        select(func.count(Camera.id), func.count(Camera.id).filter(Camera.is_active))
        .join(Post, Post.id == Camera.post_id)
        .where(Post.quarry_id == quarry_id)
    )
    cameras, cameras_active = (await db.execute(cam_stmt)).one()

    return {
        "events": int(events),
        "trucks": int(trucks),
        "volume": round(float(volume), 2),
        "unidentified": int(unidentified),
        "cameras": int(cameras),
        "cameras_active": int(cameras_active),
        "cameras_inactive": int(cameras) - int(cameras_active),
        "last_event_at": last_at.isoformat() if last_at else None,
    }


async def district_cargo(
    db: AsyncSession,
    *,
    district_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """District cargo dashboard: totals + per-post strip + per-quarry table."""
    period = _period_conds(date_from, date_to)

    totals_stmt = (
        select(*_CARGO_AGGS)
        .join(Quarry, Quarry.id == Event.quarry_id)
        .where(Quarry.district_id == district_id, *period)
    )
    _events, trucks, _volume, unidentified, last_at = (await db.execute(totals_stmt)).one()

    # Per-post traffic (posts with no events still listed via outer join).
    posts_stmt = (
        select(
            Post.id,
            Post.code,
            Post.name,
            func.count(Event.id),
            func.count(func.distinct(_PLATE)).filter(Event.plate_number != ""),
        )
        .join(Quarry, Quarry.id == Post.quarry_id)
        .outerjoin(Event, and_(Event.post_id == Post.id, *period))
        .where(Quarry.district_id == district_id)
        .group_by(Post.id, Post.code, Post.name)
        .order_by(Post.code)
    )
    post_rows = (await db.execute(posts_stmt)).all()

    cams_stmt = (
        select(Post.id, func.count(Camera.id), func.count(Camera.id).filter(Camera.is_active))
        .join(Quarry, Quarry.id == Post.quarry_id)
        .outerjoin(Camera, Camera.post_id == Post.id)
        .where(Quarry.district_id == district_id)
        .group_by(Post.id)
    )
    cams_by_post = {
        pid: (int(total), int(active)) for pid, total, active in (await db.execute(cams_stmt))
    }

    # Per-quarry count/volume table (quarries with no events still listed).
    quarries_stmt = (
        select(
            Quarry.id,
            Quarry.name,
            func.count(Event.id),
            func.coalesce(func.sum(Event.volume_final), 0),
        )
        .outerjoin(Event, and_(Event.quarry_id == Quarry.id, *period))
        .where(Quarry.district_id == district_id)
        .group_by(Quarry.id, Quarry.name)
        .order_by(Quarry.name)
    )
    quarry_rows = (await db.execute(quarries_stmt)).all()

    return {
        "trucks_total": int(trucks),
        "unidentified": int(unidentified),
        "posts": [
            {
                "id": pid,
                "code": code,
                "name": pname,
                "events": int(ev),
                "trucks": int(tr),
                "cameras": cams_by_post.get(pid, (0, 0))[0],
                "cameras_active": cams_by_post.get(pid, (0, 0))[1],
            }
            for pid, code, pname, ev, tr in post_rows
        ],
        "quarries": [
            {"id": qid, "name": qname, "count": int(cnt), "volume": round(float(vol), 2)}
            for qid, qname, cnt, vol in quarry_rows
        ],
        "last_event_at": last_at.isoformat() if last_at else None,
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
