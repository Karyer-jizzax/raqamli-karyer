"""Video AI detection: analyze (no save) + ingest (auto event). Needs DB."""

import httpx
import pytest

from app.tests.conftest import auth_header, login


@pytest.mark.asyncio
async def test_analyze_returns_detection(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "operator", "oper123")
    resp = await client.post("/api/v1/video/analyze", headers=auth_header(token))
    assert resp.status_code == 200
    det = resp.json()["detection"]
    assert det["plate_number"]
    assert det["material_id"]
    assert len(det["bbox"]) == 4


@pytest.mark.asyncio
async def test_ingest_creates_event(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "operator", "oper123")
    resp = await client.post("/api/v1/video/ingest", headers=auth_header(token))
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["event"]["volume_final"] > 0
    # The new event is newest (occurred_at desc), so it heads the list — assert
    # it by id rather than by count (the list is capped and the DB may be full).
    listing = (await client.get("/api/v1/events", headers=auth_header(token))).json()
    assert any(e["id"] == data["event"]["id"] for e in listing)


@pytest.mark.asyncio
async def test_department_cannot_ingest(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    resp = await client.post("/api/v1/video/ingest", headers=auth_header(token))
    assert resp.status_code == 400
