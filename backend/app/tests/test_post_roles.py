"""Nazorat nuqtasi rollari (posts.role) — drabilka, majburiy yo'nalish, debounce.

Nuqtaning turi avval bazada emas, karyerdagi local server configida turardi va
har hodisada `is_main` bo'lib kelardi (API.md §4). Bu testlar shu bilim endi
bazada ekanini va payload'dagi qiymatdan ustun turishini tekshiradi.
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
T0 = datetime(2026, 5, 4, 8, 0, 0)

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


async def _make_quarry(client: httpx.AsyncClient, admin: dict[str, str]) -> dict[str, object]:
    districts = (await client.get("/api/v1/districts")).json()
    quarry = (
        await client.post(
            "/api/v1/quarries",
            json={
                "district_id": districts[0]["id"],
                "name": "Drabilkali karyer",
                "code": f"DRB-{uuid.uuid4().hex[:8]}",
            },
            headers=admin,
        )
    ).json()
    _QUARRIES.append(str(quarry["id"]))
    return quarry


async def _make_post(
    client: httpx.AsyncClient,
    admin: dict[str, str],
    quarry_id: str,
    **body: object,
) -> httpx.Response:
    payload: dict[str, object] = {"code": f"P-{uuid.uuid4().hex[:6]}", "name": "Post"}
    payload.update(body)
    return await client.post(f"/api/v1/quarries/{quarry_id}/posts", json=payload, headers=admin)


async def _make_camera(client: httpx.AsyncClient, admin: dict[str, str], post_id: str) -> str:
    name = f"CAM-{uuid.uuid4().hex[:6]}"
    resp = await client.post(
        f"/api/v1/posts/{post_id}/cameras",
        json={"code": name, "name": name, "kind": "plate"},
        headers=admin,
    )
    assert resp.status_code == 201, resp.text
    return name


async def _send(client: httpx.AsyncClient, **over: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "event_uid": str(uuid.uuid4()),
        "is_main": True,
        "plate": "01S748HE",
        "weight": 31200,
        "unit": "kg",
        "event_time": _at(0),
    }
    payload.update(over)
    resp = await client.post(
        "/api/weigh",
        headers=KEY,
        data={"data": json.dumps(payload)},
        files=[("images", ("snap.jpg", b"\xff\xd8\xfffake", "image/jpeg"))],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _m1_rows(
    client: httpx.AsyncClient, token: str, quarry_id: str
) -> list[dict[str, object]]:
    resp = await client.get(
        "/api/v1/stats/m1",
        params={"quarry_id": quarry_id, "limit": 50},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["rows"]


@pytest.mark.asyncio
async def test_post_role_beats_payload_is_main(client: httpx.AsyncClient, seeded: None) -> None:
    """Postda `drabilka` roli bo'lsa, local server `is_main: true` yuborsa ham
    hodisa tarozi hodisasi bo'lib qolmaydi — endi qaror bazada."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    post = (await _make_post(client, admin, str(quarry["id"]), role="drabilka")).json()
    cam = await _make_camera(client, admin, str(post["id"]))

    body = await _send(
        client, quarry_id=quarry["code"], camera_name=cam, direction="in", is_main=True
    )
    # Zanjir karyer postlaridan chiqariladi — bu karyerda u drabilkada tugaydi.
    assert body["trip_id"] is not None

    token = await login(client, "department", "dept123")
    row = next(r for r in await _m1_rows(client, token, str(quarry["id"])) if r["id"] == body["id"])
    assert row["post_role"] == "drabilka"
    assert row["is_main"] is False


@pytest.mark.asyncio
async def test_default_direction_fills_unknown(client: httpx.AsyncClient, seeded: None) -> None:
    """Bir tomonlama kamera yo'nalishni o'lchay olmaydi — usiz hodisa
    `unknown` bo'lib inspect'ga tushardi va qatnovga ulanmasdi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    post = (
        await _make_post(
            client, admin, str(quarry["id"]), role="drabilka", default_direction="exit"
        )
    ).json()
    cam = await _make_camera(client, admin, str(post["id"]))

    body = await _send(client, quarry_id=quarry["code"], camera_name=cam, direction=None)

    token = await login(client, "department", "dept123")
    row = next(r for r in await _m1_rows(client, token, str(quarry["id"])) if r["id"] == body["id"])
    assert row["direction"] == "exit"
    assert row["status"] != "inspect"


@pytest.mark.asyncio
async def test_debounce_drops_repeat_pass(client: httpx.AsyncClient, seeded: None) -> None:
    """Navbatda turgan mashina kameraga qayta tushsa yangi qatnov yasalmaydi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    post = (
        await _make_post(client, admin, str(quarry["id"]), role="drabilka", debounce_seconds=120)
    ).json()
    cam = await _make_camera(client, admin, str(post["id"]))

    first = await _send(client, quarry_id=quarry["code"], camera_name=cam, direction="in")
    # 30 soniyadan keyin o'sha mashina yana kadrga tushdi — oyna ichida.
    second = await _send(
        client,
        quarry_id=quarry["code"],
        camera_name=cam,
        direction="in",
        event_time=(T0 + timedelta(seconds=30)).strftime("%Y-%m-%d %H:%M:%S"),
    )
    assert second["debounced"] is True
    assert second["id"] == first["id"]

    # Oynadan tashqarida (5 daqiqa) — bu haqiqiy ikkinchi o'tish.
    third = await _send(
        client, quarry_id=quarry["code"], camera_name=cam, direction="in", event_time=_at(5)
    )
    assert third["id"] != first["id"]

    token = await login(client, "department", "dept123")
    assert len(await _m1_rows(client, token, str(quarry["id"]))) == 2


@pytest.mark.asyncio
async def test_unknown_camera_is_flagged_not_guessed(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Kamera nomi mos kelmasa hodisa birinchi postga yopishtirilmaydi —
    avval shunday bo'lardi va drabilka hodisasi zavod postiga tushib ketardi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    post = (await _make_post(client, admin, str(quarry["id"]), role="tarozi")).json()
    await _make_camera(client, admin, str(post["id"]))

    body = await _send(client, quarry_id=quarry["code"], camera_name="YO-Q-KAMERA", direction="out")

    token = await login(client, "department", "dept123")
    row = next(r for r in await _m1_rows(client, token, str(quarry["id"])) if r["id"] == body["id"])
    assert row["status"] == "inspect"
    assert row["post_code"] is None


@pytest.mark.asyncio
async def test_second_scale_post_is_rejected(client: httpx.AsyncClient, seeded: None) -> None:
    """Ikkinchi tarozi — netto qaysi juftlikdan olinishi noaniq bo'lib qoladi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    assert (await _make_post(client, admin, str(quarry["id"]), role="tarozi")).status_code == 201
    dup = await _make_post(client, admin, str(quarry["id"]), role="tarozi")
    assert dup.status_code == 409, dup.text
    # Drabilka esa bir nechta bo'lishi mumkin.
    assert (await _make_post(client, admin, str(quarry["id"]), role="drabilka")).status_code == 201
    assert (await _make_post(client, admin, str(quarry["id"]), role="drabilka")).status_code == 201


@pytest.mark.asyncio
async def test_roleless_post_keeps_legacy_behaviour(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Rol belgilanmagan karyer o'zgarishsiz ishlaydi: payload'dagi `is_main`."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    post = (await _make_post(client, admin, str(quarry["id"]))).json()
    assert post["role"] is None
    cam = await _make_camera(client, admin, str(post["id"]))

    body = await _send(
        client, quarry_id=quarry["code"], camera_name=cam, direction="in", is_main=True
    )

    token = await login(client, "department", "dept123")
    row = next(r for r in await _m1_rows(client, token, str(quarry["id"])) if r["id"] == body["id"])
    assert row["is_main"] is True
    assert row["post_role"] == "tarozi"


@pytest.mark.asyncio
async def test_unweighed_post_is_not_flagged_for_inspection(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Tarozisiz nuqtada vazn yo'qligi nuqson emas.

    O'lchov holati (vazn/zichlik yo'q → "inspect") faqat tarozida ma'noga ega.
    Drabilkada u qo'llansa har bir hodisa "tekshirish kerak" navbatiga tushib,
    navbat ishlatib bo'lmaydigan holga kelardi."""
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    drabilka = (await _make_post(client, admin, str(quarry["id"]), role="drabilka")).json()
    tarozi = (await _make_post(client, admin, str(quarry["id"]), role="tarozi")).json()
    drb_cam = await _make_camera(client, admin, str(drabilka["id"]))
    scale_cam = await _make_camera(client, admin, str(tarozi["id"]))

    no_scale = await _send(
        client, quarry_id=quarry["code"], camera_name=drb_cam, direction="in", weight=None
    )
    # Tarozida esa vaznsiz hodisa haqiqatan ham nuqson — qoida saqlanadi.
    missing_weight = await _send(
        client, quarry_id=quarry["code"], camera_name=scale_cam, direction="in", weight=None
    )

    token = await login(client, "department", "dept123")
    rows = {r["id"]: r for r in await _m1_rows(client, token, str(quarry["id"]))}
    assert rows[no_scale["id"]]["status"] == "confirm"
    assert rows[missing_weight["id"]]["status"] == "inspect"
