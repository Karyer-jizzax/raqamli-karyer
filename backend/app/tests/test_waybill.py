"""Yuk xati (waybill) — authed document + its parolsiz QR page. Needs DB."""

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio

from app.tests.conftest import auth_header, login, purge_events

KEY = {"X-API-Key": "KARYER-01-SECRET"}
_UZ_TZ = timezone(timedelta(hours=5))
T0 = datetime.now(_UZ_TZ).replace(tzinfo=None, microsecond=0)

_EVENTS: list[str] = []


@pytest_asyncio.fixture(autouse=True)
async def _purge_after_test() -> AsyncGenerator[None, None]:
    start = len(_EVENTS)
    try:
        yield
    finally:
        created = _EVENTS[start:]
        del _EVENTS[start:]
        await purge_events(list(created))


async def _weigh(
    client: httpx.AsyncClient, plate: str, direction: str, kg: float, mins: int
) -> None:
    payload = {
        "event_uid": str(uuid.uuid4()),
        "quarry_id": "DEMO-1",
        "camera_name": "P-TAROZI-C1",
        "is_main": True,
        "plate": plate,
        "direction": direction,
        "weight": kg,
        "unit": "kg",
        "event_time": (T0 + timedelta(minutes=mins)).strftime("%Y-%m-%d %H:%M:%S"),
    }
    resp = await client.post("/api/weigh", headers=KEY, json=payload)
    assert resp.status_code == 200, resp.text
    _EVENTS.append(str(resp.json()["id"]))


async def _completed_trip(client: httpx.AsyncClient, token: str) -> dict[str, object]:
    """A tashqi (sotuv) trip: came in empty, left loaded. Netto = 28 t."""
    plate = "01A" + uuid.uuid4().hex[:5].upper()
    await _weigh(client, plate, "in", 22230, 0)
    await _weigh(client, plate, "out", 65750, 60)
    resp = await client.get("/api/v1/trips", params={"plate": plate}, headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    trips = resp.json()
    assert len(trips) == 1
    return trips[0]


@pytest.mark.asyncio
async def test_waybill_carries_both_weighings(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    trip = await _completed_trip(client, token)

    resp = await client.get(
        f"/api/v1/trips/{trip['id']}/waybill",
        params={"public_base": "http://localhost:5374"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    doc = resp.json()

    assert doc["number"].startswith("YX-")
    assert doc["qr_svg"].lstrip().startswith("<svg")
    assert doc["enter"]["weight_kg"] == 22230
    assert doc["exit"]["weight_kg"] == 65750
    assert doc["netto_kg"] == 43520
    assert doc["enter"]["at"] and doc["exit"]["at"]
    assert doc["kind"] == "tashqi"
    assert doc["stage"] == "yakunlandi"
    assert doc["quarry_name"]
    # The QR points at the printing app's own origin, not at the API.
    assert doc["public_url"] == f"http://localhost:5374/yuk-xati/{trip['id']}"


@pytest.mark.asyncio
async def test_waybill_number_is_stable(client: httpx.AsyncClient, seeded: None) -> None:
    """Derived from the trip, not stored — printing twice prints one number."""
    token = await login(client, "department", "dept123")
    trip = await _completed_trip(client, token)
    url = f"/api/v1/trips/{trip['id']}/waybill"
    first = await client.get(url, headers=auth_header(token))
    again = await client.get(url, headers=auth_header(token))
    assert first.json()["number"] == again.json()["number"]
    assert first.json()["verification_code"] == again.json()["verification_code"]


@pytest.mark.asyncio
async def test_public_waybill_needs_no_token(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    trip = await _completed_trip(client, token)

    authed = await client.get(f"/api/v1/trips/{trip['id']}/waybill", headers=auth_header(token))
    public = await client.get(f"/api/v1/public/waybill/{trip['id']}")
    assert public.status_code == 200, public.text
    assert public.json()["number"] == authed.json()["number"]
    assert public.json()["netto_kg"] == 43520


@pytest.mark.asyncio
async def test_unknown_trip_is_404(client: httpx.AsyncClient, seeded: None) -> None:
    missing = uuid.uuid4()
    assert (await client.get(f"/api/v1/public/waybill/{missing}")).status_code == 404
    token = await login(client, "department", "dept123")
    resp = await client.get(f"/api/v1/trips/{missing}/waybill", headers=auth_header(token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_untrusted_public_base_is_ignored(client: httpx.AsyncClient, seeded: None) -> None:
    """A client-supplied origin is only honoured when CORS already trusts it."""
    token = await login(client, "department", "dept123")
    trip = await _completed_trip(client, token)
    resp = await client.get(
        f"/api/v1/trips/{trip['id']}/waybill",
        params={"public_base": "https://phishing.example"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    assert "phishing.example" not in resp.json()["public_url"]
