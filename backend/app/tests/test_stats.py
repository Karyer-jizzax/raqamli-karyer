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
    # A dev DB can hold more than the page limit, so compare via min() —
    # a cross-join would still explode total_count far past the row count.
    token = await login(client, "department", "dept123")
    resp = await client.get("/api/v1/stats/m1?limit=500", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["rows"]) == min(data["total_count"], 500)


@pytest.mark.asyncio
async def test_reports(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    dims = {2: "material", 3: "payer_type", 4: "district", 5: "status"}
    for n, dim in dims.items():
        resp = await client.get(f"/api/v1/stats/reports/{n}", headers=auth_header(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["report"] == f"M{n}"
        assert body["dimension"] == dim
        assert isinstance(body["rows"], list)
    # Unknown report id is a clean 404, not a server error.
    bad = await client.get("/api/v1/stats/reports/9", headers=auth_header(token))
    assert bad.status_code == 404


@pytest.mark.asyncio
async def test_dynamics(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    resp = await client.get("/api/v1/stats/dynamics", headers=auth_header(token))
    assert resp.status_code == 200
    assert "buckets" in resp.json()


@pytest.mark.asyncio
async def test_overview_camera_split(client: httpx.AsyncClient, seeded: None) -> None:
    # cameras = cameras_active + cameras_inactive, all non-negative.
    token = await login(client, "department", "dept123")
    data = (
        await client.get("/api/v1/stats/overview", headers=auth_header(token))
    ).json()
    assert data["cameras"] == data["cameras_active"] + data["cameras_inactive"]
    assert data["cameras_active"] >= 0 and data["cameras_inactive"] >= 0


@pytest.mark.asyncio
async def test_quarry_stats(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    me = (await client.get("/api/v1/auth/me", headers=auth_header(token))).json()
    districts = (
        await client.get(
            f"/api/v1/districts?region_id={me['region_id']}", headers=auth_header(token)
        )
    ).json()
    district_ids = {d["id"] for d in districts}
    quarries = (
        await client.get("/api/v1/quarries", headers=auth_header(token))
    ).json()
    in_region = [q for q in quarries if q["district_id"] in district_ids]
    assert in_region
    qid = in_region[0]["id"]

    resp = await client.get(f"/api/v1/stats/quarries/{qid}", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["cameras"] == data["cameras_active"] + data["cameras_inactive"]
    assert data["events"] >= data["unidentified"] >= 0

    # A period with no events returns clean zeros, not an error.
    empty = (
        await client.get(
            f"/api/v1/stats/quarries/{qid}?date_from=1990-01-01&date_to=1990-01-02",
            headers=auth_header(token),
        )
    ).json()
    assert empty["events"] == 0
    assert empty["trucks"] == 0
    assert empty["last_event_at"] is None

    # Unknown quarry -> 404.
    missing = await client.get(
        "/api/v1/stats/quarries/00000000-0000-0000-0000-000000000000",
        headers=auth_header(token),
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_district_cargo(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")
    me = (await client.get("/api/v1/auth/me", headers=auth_header(token))).json()
    districts = (
        await client.get(
            f"/api/v1/districts?region_id={me['region_id']}", headers=auth_header(token)
        )
    ).json()
    assert districts
    did = districts[0]["id"]

    resp = await client.get(
        f"/api/v1/stats/districts/{did}/cargo", headers=auth_header(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["trucks_total"] >= 0 and data["unidentified"] >= 0
    for post in data["posts"]:
        assert post["cameras"] >= post["cameras_active"] >= 0
    for quarry in data["quarries"]:
        assert quarry["count"] >= 0 and quarry["volume"] >= 0

    # Unknown district -> 404.
    missing = await client.get(
        "/api/v1/stats/districts/00000000-0000-0000-0000-000000000000/cargo",
        headers=auth_header(token),
    )
    assert missing.status_code == 404
