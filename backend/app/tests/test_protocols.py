"""Protocol generation (integration; needs DB)."""

import httpx
import pytest

from app.tests.conftest import auth_header, login


async def _first_event_id(client: httpx.AsyncClient, token: str) -> str:
    # Ensure at least one event exists.
    body = {
        "plate_region": "80",
        "plate_number": "R 100 AA",
        "model": "HOWO",
        "direction": "exit",
        "payer_type": "indiv",
        "material_id": "qumshagal",
        "density": 1.55,
        "weight_kg": 87400,
        "length_m": 5.64,
        "width_m": 2.5,
        "height_m": 4.0,
    }
    await client.post("/api/v1/events", json=body, headers=auth_header(token))
    events = (await client.get("/api/v1/events", headers=auth_header(token))).json()
    return events[0]["id"]


@pytest.mark.asyncio
async def test_create_protocol_idempotent(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "operator", "oper123")
    event_id = await _first_event_id(client, token)

    first = await client.post(
        f"/api/v1/events/{event_id}/protocol",
        json={"inspector_name": "Inspektor"},
        headers=auth_header(token),
    )
    assert first.status_code == 201, first.text
    doc = first.json()
    assert doc["protocol"]["number"].startswith("KK-")
    assert doc["qr_svg"].lstrip().startswith("<svg")
    assert doc["material_name_uz_latn"]

    # Re-creating returns the same protocol number.
    again = await client.post(
        f"/api/v1/events/{event_id}/protocol", json={}, headers=auth_header(token)
    )
    assert again.json()["protocol"]["number"] == doc["protocol"]["number"]


@pytest.mark.asyncio
async def test_reports(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    for n in (2, 3, 4, 5):
        resp = await client.get(f"/api/v1/stats/reports/{n}", headers=auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["report"] == f"M{n}"
