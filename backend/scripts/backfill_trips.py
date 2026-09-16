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

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.event import Event
from app.models.trip import TripStop
from app.services.trips import link_event


async def main() -> None:
    async with SessionLocal() as db:
        # Qatnov zanjiriga allaqachon ulangan hodisalar.
        linked_ids = set(
            (await db.execute(select(TripStop.event_id))).scalars().all()
        )

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
