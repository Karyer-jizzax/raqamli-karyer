"""Tarozi punkti agenti oqimi (doc.txt §2–3). DB kerak.

Qamrov: token berish/bekor qilish, hodisa qabul qilish va idempotentlik,
videoni keyin yuklash, sozlamani masofadan o'zgartirish, heartbeat holati va
snapshot rejimidagi jonli kadr.
"""

import json
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio

from app.tests.conftest import auth_header, login, purge_quarries

_UZ_TZ = timezone(timedelta(hours=5))
JPEG = b"\xff\xd8\xfffake-jpeg"

# Shu modul yaratgan karyerlar — har testdan keyin o'chiriladi.
_QUARRIES: list[str] = []


@pytest_asyncio.fixture(autouse=True)
async def _purge_after_test() -> AsyncGenerator[None, None]:
    """Test karyerlari adminkadagi ro'yxatda to'planib qolmasin."""
    start = len(_QUARRIES)
    try:
        yield
    finally:
        created = _QUARRIES[start:]
        del _QUARRIES[start:]
        await purge_quarries(list(created))


async def _new_quarry(client: httpx.AsyncClient, admin: dict[str, str]) -> dict[str, object]:
    """Har bir test o'z karyeri bilan ishlaydi.

    Karyerga bitta agent to'g'ri keladi — umumiy DEMO-1 ustida ishlansa,
    bitta testdagi heartbeat yoki sozlama o'zgarishi boshqasiga oqib o'tadi."""
    districts = (await client.get("/api/v1/districts")).json()
    quarry = (
        await client.post(
            "/api/v1/quarries",
            json={
                "district_id": districts[0]["id"],
                "name": "Agent karyeri",
                "code": f"AGT-{uuid.uuid4().hex[:8]}",
            },
            headers=admin,
        )
    ).json()
    post = (
        await client.post(
            f"/api/v1/quarries/{quarry['id']}/posts",
            json={"code": f"P-{uuid.uuid4().hex[:6]}", "name": "Tarozi punkti"},
            headers=admin,
        )
    ).json()
    created = await client.post(
        f"/api/v1/posts/{post['id']}/cameras",
        json={"code": "P-TAROZI-C1", "name": "Tarozi kamerasi", "kind": "record"},
        headers=admin,
    )
    assert created.status_code == 201, created.text
    _QUARRIES.append(str(quarry["id"]))
    return quarry


async def _agent_token(client: httpx.AsyncClient, admin: dict[str, str], quarry_id: str) -> str:
    resp = await client.post(f"/api/v1/quarries/{quarry_id}/agent/token", headers=admin)
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]
    assert token.startswith("KRY_") and len(token) >= 32
    return token


def _event(**over: object) -> dict[str, object]:
    base: dict[str, object] = {
        "event_id": str(uuid.uuid4()),
        "occurred_at": datetime.now(_UZ_TZ).isoformat(timespec="seconds"),
        "weight_kg": 24580,
        "weight_stable": True,
        "scale": "KELI-D12",
        "camera_id": "P-TAROZI-C1",
        "vehicle_number": None,
        "agent_version": "1.0.0",
    }
    base.update(over)
    return base


async def _send_event(
    client: httpx.AsyncClient, token: str, payload: dict[str, object]
) -> httpx.Response:
    return await client.post(
        "/api/agent/events",
        headers=auth_header(token),
        data={"event": json.dumps(payload)},
        files=[("photo", ("frame.jpg", JPEG, "image/jpeg"))],
    )


@pytest.mark.asyncio
async def test_agent_requires_token(client: httpx.AsyncClient, seeded: None) -> None:
    assert (await client.get("/api/agent/config")).status_code == 401
    assert (
        await client.get("/api/agent/config", headers=auth_header("KRY_yoq"))
    ).status_code == 401


@pytest.mark.asyncio
async def test_token_regenerate_and_revoke(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)

    first = await _agent_token(client, admin, quarry["id"])
    assert (await client.get("/api/agent/config", headers=auth_header(first))).status_code == 200

    # Qayta generatsiya — eski token o'sha zahoti o'ladi.
    second = await _agent_token(client, admin, quarry["id"])
    assert second != first
    assert (await client.get("/api/agent/config", headers=auth_header(first))).status_code == 401
    assert (await client.get("/api/agent/config", headers=auth_header(second))).status_code == 200

    # Bekor qilish — amaldagi token ham 401 (doc §2.2).
    revoked = await client.delete(f"/api/v1/quarries/{quarry['id']}/agent/token", headers=admin)
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["is_active"] is False
    assert (await client.get("/api/agent/config", headers=auth_header(second))).status_code == 401


@pytest.mark.asyncio
async def test_operator_cannot_manage_token(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    await _agent_token(client, admin, quarry["id"])

    # Boshqa karyerning operatori bu karyerni umuman ko'rmaydi.
    operator = auth_header(await login(client, "operator", "oper123"))
    assert (
        await client.post(f"/api/v1/quarries/{quarry['id']}/agent/token", headers=operator)
    ).status_code == 403
    assert (
        await client.get(f"/api/v1/quarries/{quarry['id']}/agent", headers=operator)
    ).status_code == 403

    # Departament o'z viloyatidagi agent holatini ko'radi — lekin token
    # ko'rinmaydi va boshqara olmaydi (§2.2: token superadmin ishi).
    dept = auth_header(await login(client, "department", "dept123"))
    status_resp = await client.get(f"/api/v1/quarries/{quarry['id']}/agent", headers=dept)
    assert status_resp.status_code == 200, status_resp.text
    assert status_resp.json()["token"] is None
    assert (
        await client.post(f"/api/v1/quarries/{quarry['id']}/agent/token", headers=dept)
    ).status_code == 403


@pytest.mark.asyncio
async def test_event_photo_required_and_idempotent(
    client: httpx.AsyncClient, seeded: None
) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    token = await _agent_token(client, admin, quarry["id"])

    # Fotosiz hodisa qabul qilinmaydi — operator raqamni shundan o'qiydi.
    no_photo = await client.post(
        "/api/agent/events",
        headers=auth_header(token),
        data={"event": json.dumps(_event())},
    )
    assert no_photo.status_code == 422, no_photo.text

    payload = _event()
    first = await _send_event(client, token, payload)
    assert first.status_code == 201, first.text
    assert first.json()["duplicate"] is False
    assert first.json()["video_pending"] is True

    # Offline navbat qayta yubordi — dublikat yozilmaydi (doc §3.1).
    again = await _send_event(client, token, payload)
    assert again.status_code == 200, again.text
    assert again.json()["duplicate"] is True
    assert again.json()["id"] == first.json()["id"]


@pytest.mark.asyncio
async def test_event_reaches_m1_as_no_plate(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    token = await _agent_token(client, admin, quarry["id"])

    created = await _send_event(client, token, _event(weight_kg=18300))
    assert created.status_code == 201, created.text
    event_id = created.json()["id"]

    dept = auth_header(await login(client, "department", "dept123"))
    rows = (
        await client.get(
            "/api/v1/stats/m1",
            params={"quarry_id": quarry["id"], "status": "no_plate"},
            headers=dept,
        )
    ).json()["rows"]
    row = next(r for r in rows if r["id"] == event_id)
    assert row["weight_kg"] == 18300
    # Raqam yo'q → operator navbatiga; foto bor, video hali yo'q.
    assert row["plate_number"] == ""
    assert len(row["image_urls"]) == 1
    assert row["video_url"] is None


@pytest.mark.asyncio
async def test_unstable_weight_goes_to_inspect(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    token = await _agent_token(client, admin, quarry["id"])

    plate = "01A" + uuid.uuid4().hex[:5].upper()
    created = await _send_event(
        client, token, _event(vehicle_number=plate, weight_stable=False)
    )
    assert created.status_code == 201, created.text

    dept = auth_header(await login(client, "department", "dept123"))
    rows = (
        await client.get("/api/v1/stats/m1", params={"plate": plate[2:]}, headers=dept)
    ).json()["rows"]
    row = next(r for r in rows if r["id"] == created.json()["id"])
    assert row["status"] == "inspect"


@pytest.mark.asyncio
async def test_video_uploaded_separately(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    token = await _agent_token(client, admin, quarry["id"])

    payload = _event()
    created = await _send_event(client, token, payload)
    assert created.status_code == 201, created.text

    # Notanish event_id — 404 (doc §3.1a).
    missing = await client.put(
        f"/api/agent/events/{uuid.uuid4()}/video",
        headers={**auth_header(token), "Content-Type": "video/mp4"},
        content=b"fake-mp4",
    )
    assert missing.status_code == 404

    async def upload(body: bytes) -> str:
        resp = await client.put(
            f"/api/agent/events/{payload['event_id']}/video",
            headers={**auth_header(token), "Content-Type": "video/mp4"},
            content=body,
        )
        assert resp.status_code == 200, resp.text
        return resp.json()["video_url"]

    first_url = await upload(b"fake-mp4-part-1")
    # Uzilib qolgan yuklash boshidan takrorlanadi — eski fayl almashadi,
    # ikkita video qatori paydo bo'lmaydi.
    second_url = await upload(b"fake-mp4-part-2-longer")
    assert second_url != first_url

    dept = auth_header(await login(client, "department", "dept123"))
    rows = (
        await client.get(
            "/api/v1/stats/m1", params={"quarry_id": quarry["id"]}, headers=dept
        )
    ).json()["rows"]
    row = next(r for r in rows if r["id"] == created.json()["id"])
    assert row["video_url"] == second_url


@pytest.mark.asyncio
async def test_config_read_and_remote_update(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    token = await _agent_token(client, admin, quarry["id"])

    config = (await client.get("/api/agent/config", headers=auth_header(token))).json()
    assert config["video_quality"] == "auto"
    assert config["min_event_weight_kg"] == 500
    assert config["heartbeat_interval_sec"] == 60

    updated = await client.put(
        f"/api/v1/quarries/{quarry['id']}/agent/config",
        json={"video_quality": "low", "min_event_weight_kg": 1200, "stable_seconds": 5},
        headers=admin,
    )
    assert updated.status_code == 200, updated.text

    # Agent keyingi so'rovida yangi sozlamani oladi.
    config = (await client.get("/api/agent/config", headers=auth_header(token))).json()
    assert config["video_quality"] == "low"
    assert config["min_event_weight_kg"] == 1200
    assert config["stable_seconds"] == 5

    bad = await client.put(
        f"/api/v1/quarries/{quarry['id']}/agent/config",
        json={"video_quality": "ultra"},
        headers=admin,
    )
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_heartbeat_shows_agent_online(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    token = await _agent_token(client, admin, quarry["id"])

    before = (await client.get(f"/api/v1/quarries/{quarry['id']}/agent", headers=admin)).json()
    assert before["online"] is False

    beat = await client.post(
        "/api/agent/heartbeat",
        headers=auth_header(token),
        json={
            "agent_version": "1.0.0",
            "scale_ok": True,
            "cameras": [{"id": "cam1", "ok": True}],
            "queue_size": 3,
            "upload_kbps_avg": 1840,
            "live_streaming": True,
            "current_quality": "medium",
        },
    )
    assert beat.status_code == 200, beat.text

    after = (await client.get(f"/api/v1/quarries/{quarry['id']}/agent", headers=admin)).json()
    assert after["online"] is True
    assert after["scale_ok"] is True
    assert after["queue_size"] == 3
    assert after["current_quality"] == "medium"
    assert after["cameras"] == [{"id": "cam1", "ok": True}]
    # MediaMTX sozlanmagan bo'lsa havola berilmaydi, lekin rejim "hls" qoladi.
    assert after["live_mode"] == "hls"


@pytest.mark.asyncio
async def test_live_snapshot_round_trip(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _new_quarry(client, admin)
    token = await _agent_token(client, admin, quarry["id"])

    missing = await client.get(f"/api/v1/live-snapshot/{quarry['id']}/cam9", headers=admin)
    assert missing.status_code == 404

    pushed = await client.post(
        "/api/agent/live-snapshot",
        headers={**auth_header(token), "Content-Type": "image/jpeg", "X-Camera-Id": "cam1"},
        content=JPEG,
    )
    assert pushed.status_code == 204, pushed.text

    frame = await client.get(f"/api/v1/live-snapshot/{quarry['id']}/cam1", headers=admin)
    assert frame.status_code == 200
    assert frame.content == JPEG
    assert frame.headers["content-type"].startswith("image/jpeg")
    assert frame.headers["x-snapshot-fresh"] == "1"

    # Snapshot rejimi heartbeat'dan bilinadi — sayt JPEG ko'rinishga o'tadi.
    await client.post(
        "/api/agent/heartbeat",
        headers=auth_header(token),
        json={
            "live_streaming": False,
            "current_quality": "snapshot",
            "scale_ok": True,
            "cameras": [{"id": "cam1", "ok": True}],
        },
    )
    status_resp = (
        await client.get(f"/api/v1/quarries/{quarry['id']}/agent", headers=admin)
    ).json()
    assert status_resp["live_mode"] == "snapshot"
    assert any(s["snapshot_url"].endswith("/cam1") for s in status_resp["streams"])
