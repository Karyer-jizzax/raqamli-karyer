"""One-off fix for historic plate data.

1. Region split: `_split_plate` (now services.plates.split_plate) used to take
   up to 3 leading digits as the region, so a `20 167 TAA` plate arriving as
   "20167TAA" was stored as region="201", number="67TAA". Uzbek region codes
   are exactly 2 digits; this rewrites every such row across events, trips and
   vehicles:  ("201", "67TAA") -> ("20", "167TAA").

2. Payer type: /api/weigh used to hardcode payer_type="legal"; re-derive it
   from the plate series for weigh-ingested events (event_uid is set — manual
   events keep whatever the operator chose).

Run: uv run python -m scripts.fix_plate_regions   (or: python -m scripts.fix_plate_regions)
Idempotent — safe to re-run.
"""

import asyncio

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.event import Event
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.services.plates import payer_type


def _needs_region_fix(region: str) -> bool:
    return len(region) == 3 and region.isdigit()


async def main() -> None:
    async with SessionLocal() as db:
        fixed = {"events": 0, "trips": 0, "vehicles": 0, "payer_types": 0}

        for label, model in (("events", Event), ("trips", Trip), ("vehicles", Vehicle)):
            rows = (await db.execute(select(model))).scalars().all()
            for row in rows:
                if _needs_region_fix(row.plate_region):
                    row.plate_number = row.plate_region[2] + row.plate_number
                    row.plate_region = row.plate_region[:2]
                    fixed[label] += 1
                if (
                    model is Event
                    and row.event_uid is not None
                    and row.plate_number
                    and row.payer_type != payer_type(row.plate_number)
                ):
                    row.payer_type = payer_type(row.plate_number)
                    fixed["payer_types"] += 1

        await db.commit()
        print(
            f"fixed regions — events: {fixed['events']}, trips: {fixed['trips']}, "
            f"vehicles: {fixed['vehicles']}; payer types re-derived: {fixed['payer_types']}"
        )


if __name__ == "__main__":
    asyncio.run(main())
