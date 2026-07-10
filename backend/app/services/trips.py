"""Trip (qatnov) linking — pairs checkpoint events into one vehicle journey.

Called from the /api/weigh ingest after each NEW event (idempotent re-sends
never reach here). Matching key: (quarry, plate). Chain:

  kon enter (karyerga kirdi) → kon exit (chiqdi) → main enter (tarozi) → main exit

* kon enter → opens a trip (kind="karyer"). A previous enter that never
  produced a kon exit is superseded (status="incomplete").
* kon exit  → attaches to the open kon-enter trip; without one it opens a
  new trip (kind="karyer"). A previous kon-exit trip that never reached the
  scale is superseded.
* main enter → attaches to the open kon-exit trip within the link window;
  if none exists the vehicle came from outside → new trip (kind="tashqi").
  A previous enter-without-exit trip is superseded.
* main exit → completes the trip: netto = enter−exit (karyer, olib keldi)
  yoki exit−enter (tashqi, olib ketdi).

Events can arrive out of order (the local server retries with backoff): a
late kon exit is grafted onto the already-created tashqi trip instead of
opening a duplicate.
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.event import Event
from app.models.trip import Trip


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


async def link_event(db: AsyncSession, event: Event) -> Trip | None:
    """Attach the event to its trip (creating/completing as needed).

    Adds/updates rows on the session without committing — the caller owns
    the transaction. Returns the touched trip, or None for unlinkable events
    (no plate, kon enter, exit-without-enter).
    """
    if not event.plate_number:
        return None

    window = timedelta(hours=settings.trip_link_window_hours)

    def base_query():  # noqa: ANN202 - local helper
        return (
            select(Trip)
            .where(
                Trip.quarry_id == event.quarry_id,
                Trip.plate_region == event.plate_region,
                Trip.plate_number == event.plate_number,
                Trip.status == "open",
            )
            .order_by(Trip.started_at.desc())
        )

    if not event.is_main:
        if event.direction != "exit":
            return await _on_kon_enter(db, event, base_query, window)
        return await _on_kon_exit(db, event, base_query, window)
    if event.direction == "enter":
        return await _on_main_enter(db, event, base_query, window)
    return await _on_main_exit(db, event, base_query, window)


async def _on_kon_enter(db: AsyncSession, event: Event, base_query, window) -> Trip:
    # Out-of-order: kon chiqishi (yoki keyingi bosqich) oldinroq yetib kelgan
    # bo'lishi mumkin — kon kirishsiz ochilgan karyer qatnoviga ulaymiz.
    orphan = (
        await db.execute(
            base_query().where(
                Trip.kind == "karyer",
                Trip.kon_enter_event_id.is_(None),
                Trip.started_at >= event.occurred_at,
                Trip.started_at <= event.occurred_at + window,
            )
        )
    ).scalars().first()
    if orphan is not None:
        orphan.kon_enter_event_id = event.id
        orphan.started_at = event.occurred_at
        return orphan

    # Avvalgi kirish chiqishsiz qolgan — eskisini yopamiz.
    stale = (
        await db.execute(
            base_query().where(
                Trip.kon_enter_event_id.is_not(None),
                Trip.kon_exit_event_id.is_(None),
                Trip.main_enter_event_id.is_(None),
            )
        )
    ).scalars().all()
    for t in stale:
        t.status = "incomplete"

    trip = Trip(
        quarry_id=event.quarry_id,
        plate_region=event.plate_region,
        plate_number=event.plate_number,
        kind="karyer",
        status="open",
        kon_enter_event_id=event.id,
        started_at=event.occurred_at,
    )
    db.add(trip)
    return trip


async def _on_kon_exit(db: AsyncSession, event: Event, base_query, window) -> Trip:
    # Oddiy yo'l: karyerga kirgan (kon enter) ochiq qatnovga ulaymiz.
    entered = (
        await db.execute(
            base_query().where(
                Trip.kon_enter_event_id.is_not(None),
                Trip.kon_exit_event_id.is_(None),
                Trip.started_at >= event.occurred_at - window,
                Trip.started_at <= event.occurred_at,
            )
        )
    ).scalars().first()
    if entered is not None:
        entered.kon_exit_event_id = event.id
        return entered

    # Out-of-order: zavod kirishi kon chiqishidan OLDIN yetib kelgan bo'lishi
    # mumkin (retry backoff) — o'sha "tashqi" qatnovga ulab, turini tuzatamiz.
    orphan = (
        await db.execute(
            base_query().where(
                Trip.kon_exit_event_id.is_(None),
                Trip.main_enter_event_id.is_not(None),
                Trip.started_at >= event.occurred_at,
                Trip.started_at <= event.occurred_at + window,
            )
        )
    ).scalars().first()
    if orphan is not None:
        orphan.kon_exit_event_id = event.id
        orphan.kind = "karyer"
        if orphan.kon_enter_event_id is None:
            orphan.started_at = event.occurred_at
        orphan.netto_kg = _netto(orphan)
        return orphan

    # Avvalgi kon chiqishi zavodga yetib bormagan — eskisini yopamiz.
    stale = (
        await db.execute(
            base_query().where(Trip.main_enter_event_id.is_(None))
        )
    ).scalars().all()
    for t in stale:
        t.status = "incomplete"

    trip = Trip(
        quarry_id=event.quarry_id,
        plate_region=event.plate_region,
        plate_number=event.plate_number,
        kind="karyer",
        status="open",
        kon_exit_event_id=event.id,
        started_at=event.occurred_at,
    )
    db.add(trip)
    return trip


async def _on_main_enter(db: AsyncSession, event: Event, base_query, window) -> Trip:
    # Mashina chiqmasdan qayta kira olmaydi — chiqishi yo'qolgan eski
    # qatnov(lar)ni yopamiz.
    dangling = (
        await db.execute(
            base_query().where(
                Trip.main_enter_event_id.is_not(None),
                Trip.main_exit_event_id.is_(None),
            )
        )
    ).scalars().all()
    for t in dangling:
        t.status = "incomplete"

    # Karyerdan chiqqan ochiq qatnovga ulaymiz (link oynasi ichida).
    trip = (
        await db.execute(
            base_query().where(
                Trip.kon_exit_event_id.is_not(None),
                Trip.main_enter_event_id.is_(None),
                Trip.started_at >= event.occurred_at - window,
                Trip.started_at <= event.occurred_at,
            )
        )
    ).scalars().first()

    if trip is None:
        # Kon chiqishi yo'q — tashqaridan kelgan mashina (2-tur).
        trip = Trip(
            quarry_id=event.quarry_id,
            plate_region=event.plate_region,
            plate_number=event.plate_number,
            kind="tashqi",
            status="open",
            started_at=event.occurred_at,
        )
        db.add(trip)

    trip.main_enter_event_id = event.id
    trip.enter_weight_kg = _weight(event)
    return trip


async def _on_main_exit(db: AsyncSession, event: Event, base_query, window) -> Trip | None:
    trip = (
        await db.execute(
            base_query().where(
                Trip.main_enter_event_id.is_not(None),
                Trip.main_exit_event_id.is_(None),
                Trip.started_at >= event.occurred_at - window,
            )
        )
    ).scalars().first()
    if trip is None:
        return None  # kirishsiz chiqish — bog'laydigan qatnov yo'q

    trip.main_exit_event_id = event.id
    trip.exit_weight_kg = _weight(event)
    trip.netto_kg = _netto(trip)
    trip.status = "done"
    trip.completed_at = event.occurred_at
    return trip
