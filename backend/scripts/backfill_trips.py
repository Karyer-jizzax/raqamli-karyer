"""Backfill trips (qatnovlar) from events that were never linked.

Manually created events (POST /events) historically skipped
services.trips.link_event, so they show up in the M-1/Hodisalar log but the
"Ma'lumotlar" (trips) table stays empty. This re-feeds every plated event that
no trip references through link_event in occurred_at order — exactly as if
they had arrived from /api/weigh one by one.

Run: uv run python -m scripts.backfill_trips   (or: python -m scripts.backfill_trips)
Idempotent — already-linked events are skipped, safe to run multiple times.
"""

import asyncio

from sqlalchemy import select, union_all

from app.db.session import SessionLocal
from app.models.event import Event
from app.models.trip import Trip
from app.services.trips import link_event


async def main() -> None:
    async with SessionLocal() as db:
        # Events already attached to a trip via any of the 4 checkpoint slots.
        linked = union_all(
            select(Trip.kon_enter_event_id),
            select(Trip.kon_exit_event_id),
            select(Trip.main_enter_event_id),
            select(Trip.main_exit_event_id),
        ).subquery()
        linked_ids = {
            row[0]
            for row in (await db.execute(select(linked))).all()
            if row[0] is not None
        }

        events = (
            (
                await db.execute(
                    select(Event)
                    .where(Event.plate_number != "")
                    .order_by(Event.occurred_at.asc(), Event.created_at.asc())
                )
            )
            .scalars()
            .all()
        )

        done = skipped = 0
        for event in events:
            if event.id in linked_ids:
                skipped += 1
                continue
            trip = await link_event(db, event)
            # Har bir hodisadan keyin commit — /api/weigh oqimini takrorlaydi
            # (link_event ochiq qatnovlarni DB dan qidiradi).
            await db.commit()
            if trip is not None:
                done += 1

        print(f"linked: {done}, already linked (skipped): {skipped}, total events: {len(events)}")


if __name__ == "__main__":
    asyncio.run(main())
