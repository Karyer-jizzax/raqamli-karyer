"""Department stats + geo (integration; needs DB)."""

import httpx
import pytest

from app.tests.conftest import auth_header, login


@pytest.mark.asyncio
async def test_overview(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    resp = await client.get("/api/v1/stats/overview", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    # Seed creates the demo quarries (~86) within the department's region.
    assert data["quarries"] >= 80
    assert data["districts"] == 13


@pytest.mark.asyncio
async def test_overview_period_filter(client: httpx.AsyncClient, seeded: None) -> None:
    # Year/month scope the event metrics but not the infrastructure counts.
    token = await login(client, "department", "dept123")
    base = (
        await client.get("/api/v1/stats/overview", headers=auth_header(token))
    ).json()
    scoped = (
        await client.get(
            "/api/v1/stats/overview?year=1990&month=1", headers=auth_header(token)
        )
    ).json()
    assert scoped["quarries"] == base["quarries"]
    assert scoped["events"] == 0
    assert scoped["total_volume"] == 0


@pytest.mark.asyncio
async def test_region_geo_has_svg(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    me = (await client.get("/api/v1/auth/me", headers=auth_header(token))).json()
    resp = await client.get(f"/api/v1/regions/{me['region_id']}/geo", headers=auth_header(token))
    assert resp.status_code == 200
    geo = resp.json()
    assert len(geo["districts"]) == 13
    assert all(d["svg_path"] for d in geo["districts"])


@pytest.mark.asyncio
async def test_m1_totals_not_cross_joined(client: httpx.AsyncClient, seeded: None) -> None:
    # Regression: M1 total_count must equal the number of matching rows.
    token = await login(client, "department", "dept123")
    resp = await client.get("/api/v1/stats/m1?limit=500", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] == len(data["rows"])


@pytest.mark.asyncio
async def test_dynamics(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    resp = await client.get("/api/v1/stats/dynamics", headers=auth_header(token))
    assert resp.status_code == 200
    assert "buckets" in resp.json()
