"""Purge TEST-plate demo records from the database.

Field trials were run with test plates (01TEST07/08/09/10, 20TEST98/99);
their events, trips and media (DB rows + files on disk) are noise in the
production reports. This removes them.

Run (dry-run — faqat sanab beradi, hech narsa o'chirmaydi):
    uv run python -m scripts.purge_test_events
Actually delete:
    uv run python -m scripts.purge_test_events --yes
Idempotent — safe to re-run.
"""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import delete, or_, select

from app.db.session import SessionLocal
from app.models.event import Event
from app.models.media import Media
from app.models.trip import Trip

# (plate_region, plate_number) as stored by services.plates.split_plate.
TEST_PLATES = [
    ("01", "TEST07"),
    ("01", "TEST08"),
    ("01", "TEST09"),
    ("01", "TEST10"),
    ("20", "TEST98"),
    ("20", "TEST99"),
]


def _plate_cond(model: type[Event] | type[Trip]) -> object:
    return or_(
        *(
            (model.plate_region == r) & (model.plate_number == n)
            for r, n in TEST_PLATES
        )
    )


async def main(apply: bool) -> None:
    async with SessionLocal() as db:
        event_ids = list(
            (await db.execute(select(Event.id).where(_plate_cond(Event)))).scalars().all()
        )

        # Trips either carry a test plate themselves or reference a test event.
        trip_where = _plate_cond(Trip)
        if event_ids:
            trip_where = or_(
                trip_where,
                Trip.kon_enter_event_id.in_(event_ids),
                Trip.kon_exit_event_id.in_(event_ids),
                Trip.main_enter_event_id.in_(event_ids),
                Trip.main_exit_event_id.in_(event_ids),
            )
        trip_ids = list((await db.execute(select(Trip.id).where(trip_where))).scalars().all())

        media_rows = (
            (await db.execute(select(Media).where(Media.event_id.in_(event_ids)))).scalars().all()
            if event_ids
            else []
        )

        print(
            f"topildi — events: {len(event_ids)}, trips: {len(trip_ids)}, "
            f"media: {len(media_rows)}"
        )
        if not apply:
            print("dry-run: hech narsa o'chirilmadi (--yes bilan qayta ishga tushiring)")
            return

        # FK order: trips reference events; media references events.
        if trip_ids:
            await db.execute(delete(Trip).where(Trip.id.in_(trip_ids)))
        if media_rows:
            await db.execute(delete(Media).where(Media.id.in_([m.id for m in media_rows])))
        if event_ids:
            await db.execute(delete(Event).where(Event.id.in_(event_ids)))
        await db.commit()

        removed_files = 0
        for m in media_rows:
            p = Path(m.path)
            if p.is_file():
                p.unlink()
                removed_files += 1
        print(
            f"o'chirildi — events: {len(event_ids)}, trips: {len(trip_ids)}, "
            f"media: {len(media_rows)} (diskdan {removed_files} fayl)"
        )


if __name__ == "__main__":
    asyncio.run(main(apply="--yes" in sys.argv[1:]))
