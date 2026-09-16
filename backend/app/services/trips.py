"""Trip (qatnov) linking — pairs checkpoint events into one vehicle journey.

Called from the /api/weigh ingest after each NEW event (idempotent re-sends
never reach here). Matching key: (quarry, plate).

The chain is **not hardcoded**: `services.flow` turns the quarry's post roles
into an ordered list of steps (`"kon:exit"`, `"drabilka:enter"`, …) and this
module simply walks it. That is what lets one code path serve

    karyer → zavod             kon enter/exit → tarozi enter/exit
    karyer → drabilka          kon enter/exit → drabilka enter/exit (no scale)
    karyer → drabilka → zavod  all three nodes

Per event, in order:

* the event's step is located in the quarry's flow; a step the flow does not
  contain is never linked (a stray drabilka event in a zavod-only quarry must
  not fabricate a trip);
* it attaches to the open trip that has not reached this step yet;
* out of order (the local server retries with backoff) it is **grafted** onto
  a trip that already holds later steps, instead of opening a duplicate;
* an open trip for the same plate that this event overtook is superseded
  (status="incomplete" — chala);
* the flow's last step completes the trip. With a weighbridge on the chain
  netto comes from the two scale readings (`netto_source="scale"`); without
  one the trip is only counted (`netto_source="count"` and `netto_kg` stays
  NULL, so reports never read an unmeasured trip as zero tonnes).
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.trip import NODE_KON, WEIGHED_NODE, Trip, TripStop
from app.services.app_settings import (
    TRIP_LINK_WINDOW_HOURS,
    TRIP_MIN_NETTO_KG,
    get_int_setting,
)
from app.services.flow import has_scale, node_for_event, quarry_flow


def _weight(event: Event) -> int | None:
    """Scale reading; 0 means the checkpoint has no scale → unknown."""
    return event.weight_kg if event.weight_kg else None


def _netto(trip: Trip) -> int | None:
    """Material amount (kg, >= 0) once both weighings are known."""
    if trip.enter_weight_kg is None or trip.exit_weight_kg is None:
        return None
    if trip.kind == "karyer":  # yuk bilan keldi, bo'sh ketdi
        return max(trip.enter_weight_kg - trip.exit_weight_kg, 0)
    return max(trip.exit_weight_kg - trip.enter_weight_kg, 0)  # tashqi


def _resync(trip: Trip) -> None:
    """Header fields that are only a view over the stops.

    They stay columns because the trips list and the reports filter on them in
    SQL, but they are recomputed here so the stops remain the single source of
    truth (two independently-written copies drift apart eventually)."""
    if not trip.stops:
        return
    trip.started_at = min(s.occurred_at for s in trip.stops)
    # Kon tugunida to'xtagan bo'lsa — karyerdan yuk olib chiqqan qatnov; aks
    # holda tashqaridan kelgan mashina (tayyor mahsulot olib ketadi).
    trip.kind = "karyer" if any(s.node == NODE_KON for s in trip.stops) else "tashqi"
    enter = trip.stop(WEIGHED_NODE, "enter")
    exit_ = trip.stop(WEIGHED_NODE, "exit")
    trip.enter_weight_kg = enter.weight_kg if enter else None
    trip.exit_weight_kg = exit_.weight_kg if exit_ else None


async def _finalize(db: AsyncSession, trip: Trip, completed_at, *, scale: bool) -> None:
    """Close a trip that reached the last step of its chain.

    With a scale: compute netto and decide whether it was real cargo — netto
    below the floor means a staff car simply drove across the weighbridge,
    counted separately and never as material. The floor is runtime-tunable
    from web-main (app_settings, env default 300 kg).

    Without a scale (drabilka): nothing was weighed. `netto_kg` deliberately
    stays NULL rather than 0 — a zero would be summed into the reports as if
    the truck had hauled nothing."""
    trip.completed_at = completed_at
    if not scale:
        trip.netto_source = "count"
        trip.netto_kg = None
        trip.status = "done"
        return

    trip.netto_source = "scale"
    trip.netto_kg = _netto(trip)
    min_netto = await get_int_setting(db, TRIP_MIN_NETTO_KG)
    if trip.netto_kg is not None and trip.netto_kg < min_netto:
        trip.status = "no_cargo"
    else:
        trip.status = "done"


def _progress(trip: Trip) -> int:
    """Zanjirda qay darajaga yetgan (oxirgi to'xtash o'rni); -1 = bo'sh."""
    return max((s.seq for s in trip.stops), default=-1)


def _add_stop(trip: Trip, event: Event, node: str, seq: int) -> None:
    trip.stops.append(
        TripStop(
            seq=seq,
            node=node,
            direction=event.direction,
            post_id=event.post_id,
            event_id=event.id,
            # Vazn faqat tarozili tugunda ma'noga ega.
            weight_kg=_weight(event) if node == WEIGHED_NODE else None,
            occurred_at=event.occurred_at,
        )
    )


async def link_event(db: AsyncSession, event: Event) -> Trip | None:
    """Attach the event to its trip (creating/completing as needed).

    Adds/updates rows on the session without committing — the caller owns the
    transaction. Returns the touched trip, or None when the event cannot join
    a chain: no plate (it stays visible as "no_plate" until an operator fills
    it in and this runs again), no measured direction, or a checkpoint this
    quarry's flow does not contain.
    """
    if not event.plate_number:
        return None
    # Yo'nalishi noma'lum hodisa zanjirga ulanmaydi — "exit" deb taxmin qilish
    # soxta yakunlangan qatnov tug'diradi (ikkita kirish = bitta "done" sotuv).
    if event.direction not in ("enter", "exit"):
        return None

    flow = await quarry_flow(db, event.quarry_id)
    node = node_for_event(event.post_role, event.is_main)
    step = f"{node}:{event.direction}"
    if step not in flow:
        # Bu karyerning zanjirida bunday bosqich yo'q (masalan zavodli
        # karyerga drabilka hodisasi keldi) — hodisa jurnalda qoladi, lekin
        # taxminiy qatnov yasalmaydi.
        return None
    idx = flow.index(step)
    # Qatnov oxirgi tugunning **kutilgan hamma** bosqichlari kelganda yopiladi.
    # Faqat oxirgi bosqichga qarab bo'lmaydi: tarozidan chiqish kirishsiz
    # kelsa (kirish hodisasi kechikayotgan bo'lishi mumkin), qatnov "done"
    # bo'lib netto'siz yopilib qolardi.
    terminal_node = flow[-1].split(":")[0]
    terminal_steps = [tuple(s.split(":")) for s in flow if s.startswith(f"{terminal_node}:")]

    # Bosqichlar orasidagi tanaffus shu oynadan oshsa zanjir ulanmaydi —
    # web-main'dagi "Qatnov qoidalari"dan boshqariladi (app_settings).
    window = timedelta(hours=await get_int_setting(db, TRIP_LINK_WINDOW_HOURS))

    open_trips = list(
        (
            await db.execute(
                select(Trip)
                .where(
                    Trip.quarry_id == event.quarry_id,
                    Trip.plate_region == event.plate_region,
                    Trip.plate_number == event.plate_number,
                    Trip.status == "open",
                )
                .order_by(Trip.started_at.desc())
            )
        )
        .scalars()
        .all()
    )
    # Shu bosqichi allaqachon to'lgan qatnov nomzod bo'la olmaydi.
    free = [t for t in open_trips if t.stop(node, event.direction) is None]

    # 1) Odatiy yo'l: shu bosqichgacha yetgan ochiq qatnov.
    trip = next(
        (t for t in free if _progress(t) < idx and t.started_at >= event.occurred_at - window),
        None,
    )
    # 2) Tartibsiz kelish (retry backoff): keyingi bosqich(lar)i allaqachon
    #    yozilgan qatnov — dublikat ochmasdan o'shanga ulaymiz.
    orphan = next(
        (t for t in free if _progress(t) > idx and t.started_at <= event.occurred_at + window),
        None,
    )

    if trip is None and orphan is not None:
        trip, orphan = orphan, None
    if trip is None:
        trip = Trip(
            quarry_id=event.quarry_id,
            plate_region=event.plate_region,
            plate_number=event.plate_number,
            kind="karyer",
            status="open",
            started_at=event.occurred_at,
        )
        db.add(trip)

    _add_stop(trip, event, node, idx)

    # Ikkalasi ham topilgan edi — bitta qatnovga birlashtiramiz: kechikkan
    # bosqichlar asosiy zanjirga ko'chadi, ortiqcha qator o'chadi.
    if orphan is not None and orphan is not trip:
        for stop in list(orphan.stops):
            if trip.stop(stop.node, stop.direction) is None:
                orphan.stops.remove(stop)
                trip.stops.append(stop)
        await db.delete(orphan)

    _resync(trip)

    # Mashina bir vaqtda ikki joyda tura olmaydi: shu bosqichdan nariga
    # o'tmagan boshqa ochiq qatnov uzilib qolgan. Oxirgi bosqichda tegilmaydi
    # — u qatnovni yopadi, qolganini o'qish tomonidagi timeout (api/v1/trips)
    # chala deb ko'rsatadi.
    if idx < len(flow) - 1:
        for other in open_trips:
            if other is not trip and other is not orphan and _progress(other) <= idx:
                other.status = "incomplete"

    if all(trip.stop(node_, dir_) is not None for node_, dir_ in terminal_steps):
        completed_at = max(s.occurred_at for s in trip.stops)
        await _finalize(db, trip, completed_at, scale=has_scale(flow))

    return trip
