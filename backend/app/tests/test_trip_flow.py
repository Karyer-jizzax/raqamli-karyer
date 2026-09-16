"""Sozlanadigan qatnov zanjiri — karyer→drabilka va karyer→drabilka→zavod.

Zanjir avval kodda qattiq to'rtta bosqich edi va har doim tarozi bilan
tugardi. Bu testlar zanjir endi karyerdagi post rollaridan chiqarilishini va
tarozisiz karyerda qatnov **sanalishini** (netto o'lchanmasligini) tekshiradi.
"""

import json
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta

import httpx
import pytest
import pytest_asyncio

from app.tests.conftest import auth_header, login, purge_quarries

KEY = {"X-API-Key": "KARYER-01-SECRET"}
T0 = datetime(2026, 6, 9, 7, 0, 0)

_QUARRIES: list[str] = []


@pytest_asyncio.fixture(autouse=True)
async def _purge_after_test() -> AsyncGenerator[None, None]:
    start = len(_QUARRIES)
    try:
        yield
    finally:
        created = _QUARRIES[start:]
        del _QUARRIES[start:]
        await purge_quarries(list(created))


def _at(minutes: int) -> str:
    return (T0 + timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M:%S")


async def _quarry_with(
    client: httpx.AsyncClient, admin: dict[str, str], *roles: tuple[str, str | None]
) -> tuple[dict[str, object], dict[str, str]]:
    """Karyer + har bir rol uchun bitta post va bitta kamera. Qaytadi:
    (karyer, {rol: kamera nomi})."""
    districts = (await client.get("/api/v1/districts")).json()
    quarry = (
        await client.post(
            "/api/v1/quarries",
            json={
                "district_id": districts[0]["id"],
                "name": "Zanjir karyeri",
                "code": f"FLW-{uuid.uuid4().hex[:8]}",
            },
            headers=admin,
        )
    ).json()
    _QUARRIES.append(str(quarry["id"]))

    cams: dict[str, str] = {}
    for role, default_direction in roles:
        body: dict[str, object] = {
            "code": f"P-{uuid.uuid4().hex[:6]}",
            "name": role,
            "role": role,
        }
        if default_direction:
            body["default_direction"] = default_direction
        post = (
            await client.post(
                f"/api/v1/quarries/{quarry['id']}/posts", json=body, headers=admin
            )
        ).json()
        assert "id" in post, post
        name = f"CAM-{uuid.uuid4().hex[:6]}"
        created = await client.post(
            f"/api/v1/posts/{post['id']}/cameras",
            json={"code": name, "name": name, "kind": "plate"},
            headers=admin,
        )
        assert created.status_code == 201, created.text
        cams[role] = name
    return quarry, cams


async def _send(
    client: httpx.AsyncClient,
    quarry_code: str,
    camera: str,
    plate: str,
    direction: str,
    minutes: int,
    weight: float | None = None,
) -> dict[str, object]:
    payload = {
        "event_uid": str(uuid.uuid4()),
        "quarry_id": quarry_code,
        "camera_name": camera,
        # Local server hali `is_main` yuboradi — post roli undan ustun turishi
        # kerak, shuning uchun ataylab noto'g'ri qiymat qo'yilgan.
        "is_main": True,
        "plate": plate,
        "direction": direction,
        "weight": weight,
        "unit": "kg",
        "event_time": _at(minutes),
    }
    resp = await client.post(
        "/api/weigh",
        headers=KEY,
        data={"data": json.dumps(payload)},
        files=[("images", ("snap.jpg", b"\xff\xd8\xfffake", "image/jpeg"))],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _trips(client: httpx.AsyncClient, token: str, quarry_id: str) -> list[dict]:
    resp = await client.get(
        "/api/v1/trips",
        params={"quarry_id": quarry_id, "limit": 50},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _plate() -> str:
    return "01" + uuid.uuid4().hex[:6].upper()


@pytest.mark.asyncio
async def test_karyer_to_drabilka_chain_is_counted_not_weighed(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Tarozisi yo'q karyer: qatnov yakunlanadi, lekin netto o'lchanmaydi.

    `netto_kg` ataylab NULL bo'lib qoladi — nol bo'lsa hisobotlarda mashina
    hech narsa tashimagandek qo'shilib ketardi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry, cams = await _quarry_with(client, admin, ("kon", None), ("drabilka", None))
    plate = _plate()
    code = str(quarry["code"])

    await _send(client, code, cams["kon"], plate, "in", 0)
    await _send(client, code, cams["kon"], plate, "out", 10)
    await _send(client, code, cams["drabilka"], plate, "in", 25)
    await _send(client, code, cams["drabilka"], plate, "out", 40)

    token = await login(client, "department", "dept123")
    trips = await _trips(client, token, str(quarry["id"]))
    assert len(trips) == 1, trips
    trip = trips[0]
    assert trip["status"] == "done"
    assert trip["stage"] == "yakunlandi"
    assert trip["netto_source"] == "count"
    assert trip["netto_kg"] is None
    assert trip["volume_m3"] is None
    assert [(s["node"], s["direction"]) for s in trip["stages"]] == [
        ("kon", "enter"),
        ("kon", "exit"),
        ("drabilka", "enter"),
        ("drabilka", "exit"),
    ]

    # Hisobot: hajm nol, lekin qatnov sanalgan — tuman bo'sh ko'rinmaydi.
    stats = (
        await client.get(
            f"/api/v1/stats/quarries/{quarry['id']}", headers=auth_header(token)
        )
    ).json()
    assert stats["trips_counted"] == 1
    assert stats["trips_weighed"] == 0
    assert stats["volume"] == 0


@pytest.mark.asyncio
async def test_karyer_drabilka_zavod_three_node_chain(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Uchta tugun: drabilka o'rtada, netto baribir tarozida o'lchanadi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry, cams = await _quarry_with(
        client, admin, ("kon", None), ("drabilka", None), ("tarozi", None)
    )
    plate = _plate()
    code = str(quarry["code"])

    await _send(client, code, cams["kon"], plate, "in", 0)
    await _send(client, code, cams["kon"], plate, "out", 8)
    await _send(client, code, cams["drabilka"], plate, "in", 20)
    await _send(client, code, cams["drabilka"], plate, "out", 32)
    await _send(client, code, cams["tarozi"], plate, "in", 45, weight=40000)
    await _send(client, code, cams["tarozi"], plate, "out", 55, weight=12000)

    token = await login(client, "department", "dept123")
    trips = await _trips(client, token, str(quarry["id"]))
    assert len(trips) == 1, trips
    trip = trips[0]
    assert trip["status"] == "done"
    assert trip["kind"] == "karyer"
    assert trip["netto_source"] == "scale"
    assert trip["netto_kg"] == 28000
    assert len(trip["stages"]) == 6
    # Eski nomlar hali ishlaydi — mavjud frontend sinmasin.
    assert trip["main_enter_event_id"] is not None
    assert trip["kon_exit_event_id"] is not None


@pytest.mark.asyncio
async def test_step_outside_the_flow_is_not_linked(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Zanjirda yo'q bosqich qatnov yasamaydi.

    Bir tomonlama (faqat chiqish) darvozali karyerda kirish hodisasi kutilmaydi
    — u jurnalda qoladi, lekin taxminiy qatnov ochilmaydi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry, cams = await _quarry_with(client, admin, ("kon_chiqish", None), ("tarozi", None))
    plate = _plate()
    code = str(quarry["code"])

    stray = await _send(client, code, cams["kon_chiqish"], plate, "in", 0)
    assert stray["trip_id"] is None

    linked = await _send(client, code, cams["kon_chiqish"], plate, "out", 5)
    assert linked["trip_id"] is not None

    token = await login(client, "department", "dept123")
    trips = await _trips(client, token, str(quarry["id"]))
    assert len(trips) == 1, trips
    assert trips[0]["stage"] == "yolda"


@pytest.mark.asyncio
async def test_one_way_drabilka_camera_completes_the_chain(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Drabilkada bitta bir tomonlama kamera bo'lsa, zanjir shu bitta bosqich
    bilan tugaydi — aks holda har bir qatnov "chala" bo'lib ko'rinardi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry, cams = await _quarry_with(
        client, admin, ("kon", None), ("drabilka", "enter")
    )
    plate = _plate()
    code = str(quarry["code"])

    await _send(client, code, cams["kon"], plate, "in", 0)
    await _send(client, code, cams["kon"], plate, "out", 12)
    # Kamera yo'nalishni bermaydi — post sozlamasi "enter" deb qo'yadi.
    await _send(client, code, cams["drabilka"], plate, "", 24)

    token = await login(client, "department", "dept123")
    trips = await _trips(client, token, str(quarry["id"]))
    assert len(trips) == 1, trips
    assert trips[0]["status"] == "done"
    assert trips[0]["netto_source"] == "count"
