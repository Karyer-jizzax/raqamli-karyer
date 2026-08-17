"""Region/district geo aggregation for the dashboard map."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.quarry import Quarry
from app.models.region import District

# Demo SVG viewBox height (from MAP_DATA.H).
VIEW_HEIGHT = 586.0


async def region_geo(
    db: AsyncSession, region_id: UUID, district_id: UUID | None = None
) -> dict:
    """The region's districts, or — for an account bound to one tuman — that
    tuman alone, so the map it draws is its own district and nothing else."""
    stmt = select(District).where(District.region_id == region_id)
    if district_id is not None:
        stmt = stmt.where(District.id == district_id)
    districts = list(
        (await db.execute(stmt.order_by(District.name_uz_latn))).scalars().all()
    )

    # quarry counts per district
    qrows = (
        await db.execute(
            select(Quarry.district_id, func.count())
            .group_by(Quarry.district_id)
        )
    ).all()
    qcount = {row[0]: row[1] for row in qrows}

    # event counts per district (events -> quarry -> district)
    erows = (
        await db.execute(
            select(Quarry.district_id, func.count(Event.id))
            .join(Event, Event.quarry_id == Quarry.id)
            .group_by(Quarry.district_id)
        )
    ).all()
    ecount = {row[0]: row[1] for row in erows}

    return {
        "region_id": region_id,
        "view_height": VIEW_HEIGHT,
        "districts": [
            {
                "id": d.id,
                "name_uz_latn": d.name_uz_latn,
                "name_uz_cyrl": d.name_uz_cyrl,
                "name_ru": d.name_ru,
                "is_capital": d.is_capital,
                "svg_path": d.svg_path,
                "center_x": float(d.center_x) if d.center_x is not None else None,
                "center_y": float(d.center_y) if d.center_y is not None else None,
                "quarry_count": qcount.get(d.id, 0),
                "event_count": ecount.get(d.id, 0),
            }
            for d in districts
        ],
    }
