"""Trip (qatnov) linking through /api/weigh ingest. Needs DB.

Covers: kon exit → main enter → main exit chaining (type 1), tashqi vehicle
(type 2, netto = exit−enter), superseding a kon exit that never reached the
scale, and out-of-order arrival (main enter before its kon exit).
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio

from app.tests.conftest import auth_header, login, purge_events

KEY = {"X-API-Key": "KARYER-01-SECRET"}
# event_time is naive UZ local (UTC+5). Anchor at "now" so the read-side
# open-timeout rule (2h) never flags fresh test trips as violations.
_UZ_TZ = timezone(timedelta(hours=5))
T0 = datetime.now(_UZ_TZ).replace(tzinfo=None, microsecond=0)

# Shu modul yozgan hodisalar — har testdan keyin tozalanadi (pastdagi fixture).
_EVENTS: list[str] = []


def _plate() -> str:
    return "01A" + uuid.uuid4().hex[:5].upper()


@pytest_asyncio.fixture(autouse=True)
async def _purge_after_test() -> AsyncGenerator[None, None]:
    """Har test o'z hodisalarini o'chirib ketadi.

    Bu testlar qatnov oynasini sinash uchun ataylab **kelajak sanali** hodisa
    yozadi (`_at(+120)` va h.k.). Baza doimiy bo'lgani uchun ular yig'ilib
    boradi va bir necha ishga tushirishdan keyin hodisalar ro'yxatining
    birinchi 50 qatorini egallab, "yaratilgan hodisa ro'yxatda ko'rinadi"
    turidagi testlarni yiqitadi. Ildizi shu yerda yopiladi."""
    start = len(_EVENTS)
    try:
        yield
    finally:
        created = _EVENTS[start:]
        del _EVENTS[start:]
        await purge_events(list(created))


def _at(minutes: int) -> str:
    return (T0 + timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M:%S")


def _kon(plate: str, direction: str, minutes: int) -> dict[str, object]:
    return {
        "event_uid": str(uuid.uuid4()),
        "quarry_id": "DEMO-1",
        "camera_name": "P-KIRISH-C1",
        "is_main": False,
        "plate": plate,
        "direction": direction,
        "weight": None,
        "unit": "kg",
        "event_time": _at(minutes),
    }


def _kon_exit(plate: str, minutes: int) -> dict[str, object]:
    return _kon(plate, "out", minutes)


def _main(plate: str, direction: str, weight: float | None, minutes: int) -> dict[str, object]:
    return {
        "event_uid": str(uuid.uuid4()),
        "quarry_id": "DEMO-1",
        "camera_name": "P-TAROZI-C1",
        "is_main": True,
        "plate": plate,
        "direction": direction,
        "weight": weight,
        "unit": "kg",
        "event_time": _at(minutes),
    }


async def _send(client: httpx.AsyncClient, payload: dict[str, object]) -> dict[str, object]:
    resp = await client.post("/api/weigh", headers=KEY, json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    _EVENTS.append(str(body["id"]))
    return body


async def _trips_of(client: httpx.AsyncClient, plate: str) -> list[dict[str, object]]:
    token = await login(client, "department", "dept123")
    resp = await client.get(
        "/api/v1/trips", params={"plate": plate}, headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_type1_kon_to_zavod_chain(client: httpx.AsyncClient, seeded: None) -> None:
    """Karyerdan chiqdi → zavodda tortildi → bo'shatib chiqdi = bitta qatnov."""
    plate = _plate()
    kon = await _send(client, _kon_exit(plate, 0))
    assert kon["trip_id"] is not None

    enter = await _send(client, _main(plate, "in", 45000, 30))
    assert enter["trip_id"] == kon["trip_id"]  # kon chiqishiga ulandi

    ex = await _send(client, _main(plate, "out", 15000, 50))
    assert ex["trip_id"] == kon["trip_id"]

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    t = trips[0]
    assert t["kind"] == "karyer"
    assert t["status"] == "done"
    assert t["enter_weight_kg"] == 45000
    assert t["exit_weight_kg"] == 15000
    assert t["netto_kg"] == 30000  # olib kelingan material
    assert t["kon_exit_event_id"] == kon["id"]
    assert t["main_enter_event_id"] == enter["id"]
    assert t["main_exit_event_id"] == ex["id"]


@pytest.mark.asyncio
async def test_type2_external_vehicle(client: httpx.AsyncClient, seeded: None) -> None:
    """Tashqi mashina: bo'sh keldi (tara) → mahsulot bilan chiqdi. Netto = farq."""
    plate = _plate()
    enter = await _send(client, _main(plate, "in", 12000, 0))
    ex = await _send(client, _main(plate, "out", 40000, 20))
    assert enter["trip_id"] == ex["trip_id"]

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    t = trips[0]
    assert t["kind"] == "tashqi"
    assert t["status"] == "done"
    assert t["netto_kg"] == 28000  # olib ketilgan mahsulot
    assert t["kon_exit_event_id"] is None


@pytest.mark.asyncio
async def test_full_chain_with_kon_enter(client: httpx.AsyncClient, seeded: None) -> None:
    """Karyerga kirdi → chiqdi → zavodda tortildi → chiqdi: 4 bosqich, 1 qatnov."""
    plate = _plate()
    kin = await _send(client, _kon(plate, "in", 0))
    assert kin["trip_id"] is not None

    async def stage_of() -> str:
        return (await _trips_of(client, plate))[0]["stage"]

    assert await stage_of() == "karyerda"

    kout = await _send(client, _kon_exit(plate, 10))
    assert kout["trip_id"] == kin["trip_id"]
    assert await stage_of() == "yolda"

    enter = await _send(client, _main(plate, "in", 45000, 40))
    assert enter["trip_id"] == kin["trip_id"]
    assert await stage_of() == "zavodda"

    ex = await _send(client, _main(plate, "out", 15000, 60))
    assert ex["trip_id"] == kin["trip_id"]

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    t = trips[0]
    assert t["kind"] == "karyer"
    assert t["status"] == "done"
    assert t["stage"] == "yakunlandi"
    assert t["kon_enter_event_id"] == kin["id"]
    assert t["netto_kg"] == 30000


@pytest.mark.asyncio
async def test_out_of_order_kon_enter_grafts(client: httpx.AsyncClient, seeded: None) -> None:
    """Kon kirishi kechikib kelsa, kon chiqishi ochgan qatnovga ulanadi."""
    plate = _plate()
    kout = await _send(client, _kon_exit(plate, 10))
    kin = await _send(client, _kon(plate, "in", 0))  # occurred earlier, arrived later
    assert kin["trip_id"] == kout["trip_id"]

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    assert trips[0]["kon_enter_event_id"] == kin["id"]
    assert trips[0]["kon_exit_event_id"] == kout["id"]


@pytest.mark.asyncio
async def test_second_kon_enter_supersedes_enter_only_trip(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Kirish chiqishsiz qolsa (chala), keyingi kirish yangi qatnov ochadi."""
    plate = _plate()
    first = await _send(client, _kon(plate, "in", 0))
    second = await _send(client, _kon(plate, "in", 120))
    assert first["trip_id"] != second["trip_id"]

    trips = {t["id"]: t for t in await _trips_of(client, plate)}
    assert trips[first["trip_id"]]["status"] == "incomplete"
    assert trips[first["trip_id"]]["stage"] == "chala"
    assert trips[second["trip_id"]]["status"] == "open"


@pytest.mark.asyncio
async def test_second_kon_exit_supersedes_open_trip(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Kon chiqishi zavodga yetmagan bo'lsa, keyingi chiqish yangi qatnov ochadi."""
    plate = _plate()
    first = await _send(client, _kon_exit(plate, 0))
    second = await _send(client, _kon_exit(plate, 60))
    assert first["trip_id"] != second["trip_id"]

    trips = {t["id"]: t for t in await _trips_of(client, plate)}
    assert trips[first["trip_id"]]["status"] == "incomplete"
    assert trips[second["trip_id"]]["status"] == "open"


@pytest.mark.asyncio
async def test_out_of_order_kon_exit_grafts(client: httpx.AsyncClient, seeded: None) -> None:
    """Retry tufayli kon chiqishi kechikib kelsa ham qatnov ikkilanmaydi."""
    plate = _plate()
    enter = await _send(client, _main(plate, "in", 45000, 30))
    kon = await _send(client, _kon_exit(plate, 0))  # occurred earlier, arrived later
    assert kon["trip_id"] == enter["trip_id"]

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    assert trips[0]["kind"] == "karyer"
    assert trips[0]["kon_exit_event_id"] == kon["id"]


@pytest.mark.asyncio
async def test_plateless_event_has_no_trip(client: httpx.AsyncClient, seeded: None) -> None:
    payload = _main("X", "in", 30000, 0)
    payload["plate"] = None
    resp = await _send(client, payload)
    assert resp["trip_id"] is None


@pytest.mark.asyncio
async def test_low_netto_marks_no_cargo(client: httpx.AsyncClient, seeded: None) -> None:
    """Netto < 300 kg — xodim mashinasi shunchaki o'tgan, yuk emas."""
    plate = _plate()
    await _send(client, _main(plate, "in", 12000, 0))
    await _send(client, _main(plate, "out", 12100, 10))

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    t = trips[0]
    assert t["netto_kg"] == 100
    assert t["status"] == "no_cargo"
    assert t["stage"] == "yuk_emas"


@pytest.mark.asyncio
async def test_netto_floor_is_runtime_tunable(client: httpx.AsyncClient, seeded: None) -> None:
    """Chegara web-main'dan (settings API) o'zgartirilsa darhol amal qiladi."""
    token = await login(client, "admin", "admin123")
    hdr = auth_header(token)
    original = (await client.get("/api/v1/settings/trip-rules", headers=hdr)).json()

    resp = await client.put(
        "/api/v1/settings/trip-rules",
        json={**original, "trip_min_netto_kg": 5000},
        headers=hdr,
    )
    assert resp.status_code == 200, resp.text
    try:
        plate = _plate()
        await _send(client, _main(plate, "in", 12000, 0))
        await _send(client, _main(plate, "out", 16000, 10))  # netto 4000 < 5000

        trips = await _trips_of(client, plate)
        assert trips[0]["status"] == "no_cargo"
    finally:
        # Boshqa testlar default chegaraga tayanadi — qaytarib qo'yamiz.
        await client.put("/api/v1/settings/trip-rules", json=original, headers=hdr)


@pytest.mark.asyncio
async def test_open_timeout_flags_violation(client: httpx.AsyncClient, seeded: None) -> None:
    """Zavodga kirdi, 2+ soatdan beri chiqmagan — o'qishda huquqbuzarlik."""
    plate = _plate()
    await _send(client, _main(plate, "in", 45000, -200))  # ~3.3 soat oldin

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    assert trips[0]["status"] == "incomplete"
    assert trips[0]["stage"] == "chala"


@pytest.mark.asyncio
async def test_exit_without_enter_opens_trip(client: httpx.AsyncClient, seeded: None) -> None:
    """Kirishsiz chiqish yo'qolmaydi: qatnov ochiladi, kechikkan kirish yakunlaydi."""
    plate = _plate()
    ex = await _send(client, _main(plate, "out", 40000, 20))
    assert ex["trip_id"] is not None

    trips = await _trips_of(client, plate)
    assert trips[0]["status"] == "open"  # hali timeout bo'lmagan

    enter = await _send(client, _main(plate, "in", 12000, 0))  # retry'da kechikkan
    assert enter["trip_id"] == ex["trip_id"]

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    assert trips[0]["status"] == "done"
    assert trips[0]["netto_kg"] == 28000


@pytest.mark.asyncio
async def test_exit_without_enter_times_out(client: httpx.AsyncClient, seeded: None) -> None:
    """Teskari holat: chiqish bor, kirish 2+ soat kelmadi — huquqbuzarlik."""
    plate = _plate()
    await _send(client, _main(plate, "out", 40000, -200))

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    assert trips[0]["status"] == "incomplete"
    assert trips[0]["stage"] == "chala"


@pytest.mark.asyncio
async def test_no_plate_event_fixed_manually(client: httpx.AsyncClient, seeded: None) -> None:
    """Raqamsiz hodisa serverda no_plate bo'ladi; raqam kiritilgach juftlanadi."""
    plate = _plate()
    payload = _main("", "in", 45000, 0)
    payload["plate"] = None  # ANPR o'qiy olmadi — server o'zi no_plate qiladi
    resp = await _send(client, payload)
    assert resp["trip_id"] is None

    token = await login(client, "admin", "admin123")
    fix = await client.patch(
        f"/api/v1/events/{resp['id']}/plate",
        json={"plate_region": plate[:2], "plate_number": plate[2:]},
        headers=auth_header(token),
    )
    assert fix.status_code == 200, fix.text
    assert fix.json()["status"] == "confirm"
    assert fix.json()["plate_number"] == plate[2:]

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    assert trips[0]["main_enter_event_id"] == resp["id"]


@pytest.mark.asyncio
async def test_trip_surfaces_stage_media(client: httpx.AsyncClient, seeded: None) -> None:
    """Har bosqichning foto/videosi qatnovda ko'rinadi (UI modal uchun)."""
    import json as jsonlib

    plate = _plate()
    enter = _main(plate, "in", 45000, 0)
    resp = await client.post(
        "/api/weigh",
        headers=KEY,
        data={"data": jsonlib.dumps(enter)},
        files=[
            ("images", ("snap0.jpg", b"\xff\xd8\xfffake", "image/jpeg")),
            ("video", ("clip.mp4", b"fake-mp4", "video/mp4")),
        ],
    )
    assert resp.status_code == 200, resp.text
    _EVENTS.append(str(resp.json()["id"]))

    trips = await _trips_of(client, plate)
    assert len(trips) == 1
    stage = trips[0]["main_enter"]
    assert stage is not None
    assert stage["event_id"] == resp.json()["id"]
    assert len(stage["image_urls"]) == 1
    assert stage["video_url"] is not None
    assert trips[0]["kon_exit"] is None


@pytest.mark.asyncio
async def test_main_only_hides_trips_without_zavod_event(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """main_only=true — karyerda/yo'lda turgan qatnovlar ro'yxatga tushmaydi."""
    token = await login(client, "department", "dept123")

    async def listed(plate: str, *, main_only: bool) -> int:
        params: dict[str, object] = {"plate": plate}
        if main_only:
            params["main_only"] = "true"
        resp = await client.get("/api/v1/trips", params=params, headers=auth_header(token))
        assert resp.status_code == 200, resp.text
        return len(resp.json())

    # Faqat karyer hodisalari: kirdi → chiqdi, zavodga yetmagan.
    kon_plate = _plate()
    await _send(client, _kon(kon_plate, "in", 0))
    await _send(client, _kon_exit(kon_plate, 10))
    assert await listed(kon_plate, main_only=False) == 1
    assert await listed(kon_plate, main_only=True) == 0

    # Zavod tarozisidan o'tgan qatnov — filtrda ham qoladi.
    zavod_plate = _plate()
    await _send(client, _main(zavod_plate, "in", 45000, 0))
    assert await listed(zavod_plate, main_only=True) == 1
