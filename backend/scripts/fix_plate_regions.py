"""One-off fix for historic plate data.

Region split: `_split_plate` (now services.plates.split_plate) used to take up
to 3 leading digits as the region, so a `20 167 TAA` plate arriving as
"20167TAA" was stored as region="201", number="67TAA". Uzbek region codes are
exactly 2 digits; this rewrites every such row across events, trips and
vehicles:  ("201", "67TAA") -> ("20", "167TAA").

(This script also used to re-derive `payer_type` from the plate series. That
column is gone — see migration 0016.)

Run: uv run python -m scripts.fix_plate_regions   (or: python -m scripts.fix_plate_regions)
Idempotent — safe to re-run.
"""

import asyncio

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.event import Event
from app.models.trip import Trip
from app.models.vehicle import Vehicle


def _needs_region_fix(region: str) -> bool:
    return len(region) == 3 and region.isdigit()


async def main() -> None:
    async with SessionLocal() as db:
        fixed = {"events": 0, "trips": 0, "vehicles": 0}

        for label, model in (("events", Event), ("trips", Trip), ("vehicles", Vehicle)):
            rows = (await db.execute(select(model))).scalars().all()
            for row in rows:
                if _needs_region_fix(row.plate_region):
                    row.plate_number = row.plate_region[2] + row.plate_number
                    row.plate_region = row.plate_region[:2]
                    fixed[label] += 1

        await db.commit()
        print(
            f"fixed regions — events: {fixed['events']}, trips: {fixed['trips']}, "
            f"vehicles: {fixed['vehicles']}"
        )


if __name__ == "__main__":
    asyncio.run(main())
