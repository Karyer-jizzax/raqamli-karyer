"""Purge "Yakunlanmagan" (chala) trips and the events they were built from.

A trip goes `status="incomplete"` when its checkpoint chain breaks — a zavod
entry with no matching exit, a kon exit superseded by a newer one. On the
Ma'lumotlar grid these show as "Yakunlanmagan" with empty weight columns; the
M-1 log still carries the events underneath them.

This removes both: the trip rows, their linked events, and those events' media
(DB rows plus the files on disk). Nothing else is touched — a trip that is
merely open (karyerda / yo'lda / zavodda, still waiting for its next event) is
left alone, because it is not broken, just unfinished.

Protokol (o'lchov bayonnomasi) — an official numbered document — may have been
issued against one of these events. Deleting the event would destroy that
record, so by default any trip holding such an event is SKIPPED and reported.
Pass --with-protocols to delete the protocols too, deliberately.

Run (dry-run — faqat sanab beradi, hech narsa o'chirmaydi):
    python -m scripts.purge_incomplete_trips
Actually delete:
    python -m scripts.purge_incomplete_trips --yes
Only one quarry (karyer kodi bo'yicha):
    python -m scripts.purge_incomplete_trips --quarry KARYER01
Idempotent — safe to re-run.
"""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import delete, or_, select

from app.db.session import SessionLocal
from app.models.event import Event
from app.models.media import Media
from app.models.protocol import Protocol
from app.models.quarry import Quarry
from app.models.trip import Trip

# The four checkpoint columns a trip can hold an event in.
EVENT_COLS = (
    Trip.kon_enter_event_id,
    Trip.kon_exit_event_id,
    Trip.main_enter_event_id,
    Trip.main_exit_event_id,
)


def _arg(flag: str) -> str | None:
    """`--quarry KOD` — qiymatni argumentlar ro'yxatidan oladi."""
    args = sys.argv[1:]
    if flag not in args:
        return None
    i = args.index(flag)
    return args[i + 1] if i + 1 < len(args) else None


async def main(apply: bool, with_protocols: bool, quarry_code: str | None) -> None:
    async with SessionLocal() as db:
        where = [Trip.status == "incomplete"]
        if quarry_code:
            quarry_id = (
                await db.execute(select(Quarry.id).where(Quarry.code == quarry_code))
            ).scalar_one_or_none()
            if quarry_id is None:
                print(f"karyer topilmadi: {quarry_code}")
                return
            where.append(Trip.quarry_id == quarry_id)

        trips = (await db.execute(select(Trip).where(*where))).scalars().all()
        if not trips:
            print("yakunlanmagan qatnov yo'q — o'chiradigan narsa topilmadi")
            return

        # Har bir qatnovning hodisalari. Bitta hodisa faqat bitta qatnovga
        # tegishli bo'ladi (birlashtirishda ortiqcha qator o'chadi), lekin
        # ishonch uchun quyida omon qoladigan qatnovlar bo'yicha tekshiriladi.
        by_trip: dict[object, list[object]] = {
            t.id: [
                eid
                for eid in (
                    t.kon_enter_event_id,
                    t.kon_exit_event_id,
                    t.main_enter_event_id,
                    t.main_exit_event_id,
                )
                if eid is not None
            ]
            for t in trips
        }
        all_event_ids = {eid for ids in by_trip.values() for eid in ids}

        # Bayonnoma yozilgan hodisalar — rasmiy hujjat. Ularni ushlab turgan
        # qatnov butunlay chetlab o'tiladi: hujjatsiz qolgan bayonnoma ham,
        # bayonnomasiz qolgan hujjat ham noto'g'ri.
        protocol_events = set(
            (
                await db.execute(
                    select(Protocol.event_id).where(Protocol.event_id.in_(all_event_ids))
                )
            ).scalars().all()
        ) if all_event_ids else set()

        skipped = []
        if protocol_events and not with_protocols:
            skipped = [t for t in trips if set(by_trip[t.id]) & protocol_events]
            trips = [t for t in trips if t not in skipped]
            by_trip = {t.id: by_trip[t.id] for t in trips}
            all_event_ids = {eid for ids in by_trip.values() for eid in ids}

        trip_ids = [t.id for t in trips]

        # Omon qoladigan qatnov hali ham ko'rsatib turgan hodisani o'chirmaymiz
        # — aks holda o'sha qatnov bo'sh havola bilan qolardi.
        still_used = set(
            (
                await db.execute(
                    select(Event.id)
                    .join(Trip, or_(*(col == Event.id for col in EVENT_COLS)))
                    .where(Event.id.in_(all_event_ids), Trip.id.notin_(trip_ids))
                )
            ).scalars().all()
        ) if all_event_ids and trip_ids else set()
        event_ids = sorted(all_event_ids - still_used, key=str)

        media_rows = (
            (
                await db.execute(select(Media).where(Media.event_id.in_(event_ids)))
            ).scalars().all()
            if event_ids
            else []
        )

        quarry_names = dict(
            (
                await db.execute(
                    select(Quarry.id, Quarry.name).where(
                        Quarry.id.in_({t.quarry_id for t in trips})
                    )
                )
            ).all()
        ) if trips else {}

        print(f"o'chiriladi — qatnov: {len(trip_ids)}, hodisa: {len(event_ids)}, "
              f"media: {len(media_rows)}")
        for t in sorted(trips, key=lambda x: x.started_at):
            print(
                f"  {t.started_at:%d.%m.%Y %H:%M}  {t.plate_region} {t.plate_number:<10}"
                f"  {t.kind:<7} {quarry_names.get(t.quarry_id, '?'):<20}"
                f"  hodisa: {len(by_trip[t.id])}"
            )
        if skipped:
            print(
                f"\nchetlab o'tildi (bayonnoma yozilgan): {len(skipped)} qatnov — "
                "ularni ham o'chirish uchun --with-protocols"
            )
            for t in sorted(skipped, key=lambda x: x.started_at):
                print(f"  {t.started_at:%d.%m.%Y %H:%M}  {t.plate_region} {t.plate_number}")
        if still_used:
            print(f"\nsaqlanadi (boshqa qatnov ishlatyapti): {len(still_used)} hodisa")

        if not apply:
            print("\ndry-run: hech narsa o'chirilmadi (--yes bilan qayta ishga tushiring)")
            return

        # FK tartibi: qatnov va bayonnoma hodisaga, media ham hodisaga tayanadi.
        if trip_ids:
            await db.execute(delete(Trip).where(Trip.id.in_(trip_ids)))
        if event_ids and with_protocols:
            await db.execute(delete(Protocol).where(Protocol.event_id.in_(event_ids)))
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
            f"\no'chirildi — qatnov: {len(trip_ids)}, hodisa: {len(event_ids)}, "
            f"media: {len(media_rows)} (diskdan {removed_files} fayl)"
        )


if __name__ == "__main__":
    flags = sys.argv[1:]
    asyncio.run(
        main(
            apply="--yes" in flags,
            with_protocols="--with-protocols" in flags,
            quarry_code=_arg("--quarry"),
        )
    )
