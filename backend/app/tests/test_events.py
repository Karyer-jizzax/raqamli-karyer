"""Events: volume preview, authoritative create as operator, scoped list."""

import httpx
import pytest

from app.tests.conftest import auth_header, login


@pytest.mark.asyncio
async def test_volume_preview(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "operator", "oper123")
    body = {
        "material_id": "qumshagal",
        "density": 1.55,
        "weight_kg": 87400,
        "length_m": 5.64,
        "width_m": 2.5,
        "height_m": 4.0,
    }
    resp = await client.post("/api/v1/volume/preview", json=body, headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirm"
    assert abs(data["volume_scale"] - 56.39) < 0.1


@pytest.mark.asyncio
async def test_operator_create_and_scoped_list(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "operator", "oper123")
    headers = auth_header(token)

    body = {
        "plate_region": "80",
        "plate_number": "R 548 SA",
        "model": "HOWO",
        "direction": "exit",
        "payer_type": "indiv",
        "material_id": "qumshagal",
        "density": 1.55,
        "weight_kg": 87400,
        "length_m": 5.64,
        "width_m": 2.5,
        "height_m": 4.0,
        "owner_name": "Test egasi",
        "stir": "31702851170041",
    }
    create = await client.post("/api/v1/events", json=body, headers=headers)
    assert create.status_code == 201, create.text
    event = create.json()
    # Server computed the volume/status authoritatively.
    assert event["status"] == "confirm"
    assert event["volume_final"] > 0

    listed = await client.get("/api/v1/events", headers=headers)
    assert listed.status_code == 200
    assert any(e["id"] == event["id"] for e in listed.json())


@pytest.mark.asyncio
async def test_events_require_auth(client: httpx.AsyncClient) -> None:
    resp = await client.get("/api/v1/events")
    assert resp.status_code == 401
