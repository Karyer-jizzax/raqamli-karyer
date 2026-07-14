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
  yoki exit−enter (tashqi, olib ketdi). Netto below trip_min_netto_kg means
  no real cargo (a staff car) → status "no_cargo" instead of "done". An exit
  with no matching enter opens an exit-only trip: a late enter completes it,
  otherwise the read-side timeout surfaces it as a violation.

Events can arrive out of order (the local server retries with backoff): a
late kon exit is grafted onto the already-created tashqi trip instead of
opening a duplicate.
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.trip import Trip
from app.services.app_settings import (
    TRIP_LINK_WINDOW_HOURS,
    TRIP_MIN_NETTO_KG,
    get_int_setting,
)


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


async def _finalize(db: AsyncSession, trip: Trip, completed_at) -> None:
    """Close a trip that has both scale readings: compute netto and decide
    whether it was real cargo. Netto below the floor means a staff car simply
    drove across the scale — counted separately, never as material. The floor
    is runtime-tunable from web-main (app_settings, env default 300 kg)."""
    trip.netto_kg = _netto(trip)
    min_netto = await get_int_setting(db, TRIP_MIN_NETTO_KG)
    if trip.netto_kg is not None and trip.netto_kg < min_netto:
        trip.status = "no_cargo"
    else:
        trip.status = "done"
    trip.completed_at = completed_at


async def link_event(db: AsyncSession, event: Event) -> Trip | None:
    """Attach the event to its trip (creating/completing as needed).

    Adds/updates rows on the session without committing — the caller owns
    the transaction. Returns the touched trip, or None for plateless events
    (those stay visible as "no_plate" until an operator fills the plate in
    and this function is called again).
    """
    if not event.plate_number:
        return None
    # Yo'nalishi noma'lum hodisa zanjirga ulanmaydi — "exit" deb taxmin qilish
    # soxta yakunlangan qatnov tug'diradi (ikkita kirish = bitta "done" sotuv).
    if event.direction not in ("enter", "exit"):
        return None

    # Karyerdan chiqish → zavodga kirish oralig'i shu oynadan oshsa zanjir
    # ulanmaydi — zavod hodisasi "tashqi" (sotuv) qatnov sifatida ochiladi.
    # Web-main'dagi "Qatnov qoidalari"dan boshqariladi (app_settings).
    window = timedelta(hours=await get_int_setting(db, TRIP_LINK_WINDOW_HOURS))

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

    # Out-of-order: zavod chiqishi kirishdan OLDIN yetib kelgan bo'lishi
    # mumkin (retry backoff) — chiqishgina bor ochiq qatnov qolgan.
    orphan = (
        await db.execute(
            base_query().where(
                Trip.main_enter_event_id.is_(None),
                Trip.main_exit_event_id.is_not(None),
                Trip.started_at >= event.occurred_at,
                Trip.started_at <= event.occurred_at + window,
            )
        )
    ).scalars().first()

    if trip is None and orphan is not None:
        # Kon zanjiri yo'q — chiqish ochgan qatnovning o'zini yakunlaymiz.
        orphan.main_enter_event_id = event.id
        orphan.enter_weight_kg = _weight(event)
        exit_at = orphan.main_exit_at or event.occurred_at
        orphan.started_at = event.occurred_at
        await _finalize(db, orphan, exit_at)
        return orphan

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

    if orphan is not None and orphan is not trip:
        # Kon zanjiri ham, oldin kelgan chiqish ham bor — bitta qatnovga
        # birlashtiramiz: chiqish hodisasi karyer qatnoviga o'tadi, ortiqcha
        # qator o'chadi (netto yo'nalishi kind bo'yicha to'g'ri hisoblanadi).
        trip.main_exit_event_id = orphan.main_exit_event_id
        trip.exit_weight_kg = orphan.exit_weight_kg
        exit_at = orphan.main_exit_at or event.occurred_at
        await db.delete(orphan)
        await _finalize(db, trip, exit_at)

    return trip


async def _on_main_exit(db: AsyncSession, event: Event, base_query, window) -> Trip:
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
        # Kirishsiz chiqish. Kirish hodisasi retry tufayli kechikayotgan
        # bo'lishi mumkin — ochiq qatnov ochamiz; kirish kelsa juftlanadi,
        # kelmasa timeout'dan keyin "incomplete" (huquqbuzarlik) ko'rinadi.
        trip = Trip(
            quarry_id=event.quarry_id,
            plate_region=event.plate_region,
            plate_number=event.plate_number,
            kind="tashqi",
            status="open",
            main_exit_event_id=event.id,
            exit_weight_kg=_weight(event),
            started_at=event.occurred_at,
        )
        db.add(trip)
        return trip

    trip.main_exit_event_id = event.id
    trip.exit_weight_kg = _weight(event)
    await _finalize(db, trip, event.occurred_at)
    return trip
