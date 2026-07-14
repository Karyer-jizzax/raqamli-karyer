"""Quarry local-server ingest (/api/weigh + /api/ping). Needs DB.

Covers the API.md contract: X-API-Key auth, Format B multipart with images +
video, event_uid idempotency, and media surfacing on the created event.
"""

import json
import uuid

import httpx
import pytest

from app.tests.conftest import auth_header, login

KEY = {"X-API-Key": "KARYER-01-SECRET"}


def _payload(event_uid: str, **over: object) -> dict[str, object]:
    base: dict[str, object] = {
        "event_uid": event_uid,
        "quarry_id": "DEMO-1",
        "camera_name": "P-TAROZI-C1",
        "is_main": True,
        "plate": "01S748HE",
        "weight": 31200,
        "unit": "kg",
        "event_time": "2026-07-05 14:39:27",
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_ping(client: httpx.AsyncClient) -> None:
    resp = await client.get("/api/ping")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_weigh_requires_api_key(client: httpx.AsyncClient) -> None:
    resp = await client.post("/api/weigh", json=_payload(str(uuid.uuid4())))
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_weigh_multipart_creates_event_with_media(
    client: httpx.AsyncClient, seeded: None
) -> None:
    uid = str(uuid.uuid4())
    plate = "01A" + uuid.uuid4().hex[:5].upper()
    files = [
        ("images", ("snap0.jpg", b"\xff\xd8\xfffake", "image/jpeg")),
        ("video", ("clip.mp4", b"fake-mp4", "video/mp4")),
    ]
    resp = await client.post(
        "/api/weigh",
        headers=KEY,
        data={"data": json.dumps(_payload(uid, plate=plate))},
        files=files,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["event_uid"] == uid

    # The event surfaces in the department M1 grid with weight + media urls.
    token = await login(client, "department", "dept123")
    rows = (
        await client.get(
            "/api/v1/stats/m1", params={"plate": plate[2:]}, headers=auth_header(token)
        )
    ).json()["rows"]
    row = next(r for r in rows if r["id"] == body["id"])
    assert row["weight_kg"] == 31200
    assert row["is_main"] is True
    assert row["plate_region"] == "01" and row["plate_number"] == plate[2:]
    assert len(row["image_urls"]) == 1
    assert row["video_url"] is not None


@pytest.mark.asyncio
async def test_weigh_accepts_large_video_over_1mb(
    client: httpx.AsyncClient, seeded: None
) -> None:
    # Starlette's default part cap is 1MB; a real ~10s clip is larger. Ensure a
    # 2MB part is accepted (regression for the raised max_part_size).
    big = b"\x00" * (2 * 1024 * 1024)
    resp = await client.post(
        "/api/weigh",
        headers=KEY,
        data={"data": json.dumps(_payload(str(uuid.uuid4())))},
        files=[("video", ("clip.mp4", big, "video/mp4"))],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_weigh_is_idempotent(client: httpx.AsyncClient, seeded: None) -> None:
    uid = str(uuid.uuid4())
    first = await client.post("/api/weigh", headers=KEY, json=_payload(uid))
    second = await client.post("/api/weigh", headers=KEY, json=_payload(uid))
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert second.json().get("duplicate") is True


@pytest.mark.asyncio
async def test_weigh_maps_direction_in_out(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "department", "dept123")

    async def dir_of(direction: object) -> str:
        uid = str(uuid.uuid4())
        plate = "01A" + uuid.uuid4().hex[:5].upper()
        r = await client.post(
            "/api/weigh", headers=KEY, json=_payload(uid, direction=direction, plate=plate)
        )
        assert r.status_code == 200, r.text
        rows = (
            await client.get(
                "/api/v1/stats/m1", params={"plate": plate[2:]}, headers=auth_header(token)
            )
        ).json()["rows"]
        return next(row["direction"] for row in rows if row["id"] == r.json()["id"])

    assert await dir_of("in") == "enter"
    assert await dir_of("out") == "exit"
    assert await dir_of(None) == "unknown"  # taxmin yo'q — operator inspect'da ko'radi


@pytest.mark.asyncio
async def test_weigh_kon_event_without_weight(client: httpx.AsyncClient, seeded: None) -> None:
    uid = str(uuid.uuid4())
    resp = await client.post(
        "/api/weigh",
        headers=KEY,
        json=_payload(uid, is_main=False, plate=None, weight=None),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True
