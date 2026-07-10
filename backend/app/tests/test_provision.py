"""Local-server provisioning flow (integration; needs DB).

web-main issues a provision token for a quarry → the local server exchanges
it at GET /api/local/config for quarry code + ingest api_key + camera names →
that api_key is then valid on /api/weigh for THIS quarry only.
"""

import uuid

import httpx
import pytest

from app.tests.conftest import auth_header, login


async def _make_quarry(client: httpx.AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    districts = (await client.get("/api/v1/districts")).json()
    code = f"Q-{uuid.uuid4().hex[:8]}"
    create = await client.post(
        "/api/v1/quarries",
        json={"district_id": districts[0]["id"], "name": "Provision karyer", "code": code},
        headers=headers,
    )
    assert create.status_code == 201, create.text
    return {"id": create.json()["id"], "code": code}


@pytest.mark.asyncio
async def test_provision_token_and_local_config(
    client: httpx.AsyncClient, seeded: None
) -> None:
    token = await login(client, "admin", "admin123")
    headers = auth_header(token)
    quarry = await _make_quarry(client, headers)

    # camera the local server must name in its stations
    post = await client.post(
        f"/api/v1/quarries/{quarry['id']}/posts",
        json={"code": f"P-{uuid.uuid4().hex[:6]}", "name": "Tarozi posti"},
        headers=headers,
    )
    cam_code = f"C-{uuid.uuid4().hex[:6]}"
    await client.post(
        f"/api/v1/posts/{post.json()['id']}/cameras",
        json={"code": cam_code, "name": "Raqam kamerasi", "kind": "plate"},
        headers=headers,
    )

    issued = await client.post(
        f"/api/v1/quarries/{quarry['id']}/provision-token",
        json={"server_url": "http://test"},
        headers=headers,
    )
    assert issued.status_code == 200, issued.text
    assert issued.json()["quarry_code"] == quarry["code"]
    provision_jwt = issued.json()["token"]

    # local server exchanges the token for its config
    cfg = await client.get(
        "/api/local/config", headers={"Authorization": f"Bearer {provision_jwt}"}
    )
    assert cfg.status_code == 200, cfg.text
    body = cfg.json()
    assert body["quarry_id"] == quarry["code"]
    assert body["server"]["url"] == "http://test"
    assert body["server"]["endpoint"] == "/api/weigh"
    api_key = body["server"]["api_key"]
    assert api_key
    assert any(c["code"] == cam_code for c in body["cameras"])

    # re-issuing keeps the same api_key (installed servers stay valid)
    again = await client.post(
        f"/api/v1/quarries/{quarry['id']}/provision-token",
        json={"server_url": "http://test"},
        headers=headers,
    )
    cfg2 = await client.get(
        "/api/local/config",
        headers={"Authorization": f"Bearer {again.json()['token']}"},
    )
    assert cfg2.json()["server"]["api_key"] == api_key

    # the provisioned key is accepted on /api/weigh for this quarry...
    weigh = await client.post(
        "/api/weigh",
        headers={"X-API-Key": api_key},
        json={
            "event_uid": str(uuid.uuid4()),
            "quarry_id": quarry["code"],
            "camera_name": cam_code,
            "is_main": True,
            "plate": "01A123BC",
            "weight": 10000,
            "event_time": "2026-07-10 10:00:00",
        },
    )
    assert weigh.status_code == 200, weigh.text

    # ...but not for another quarry
    other = await client.post(
        "/api/weigh",
        headers={"X-API-Key": api_key},
        json={
            "event_uid": str(uuid.uuid4()),
            "quarry_id": "DEMO-1",
            "camera_name": "P-TAROZI-C1",
            "is_main": True,
            "plate": "01A123BC",
            "weight": 10000,
            "event_time": "2026-07-10 10:00:00",
        },
    )
    assert other.status_code == 401
    # No cleanup: the weigh event references the camera (FK), so the quarry
    # can't be deleted — like test_weigh, we leave the rows in the dev DB.


@pytest.mark.asyncio
async def test_local_config_rejects_bad_tokens(client: httpx.AsyncClient, seeded: None) -> None:
    # no token
    assert (await client.get("/api/local/config")).status_code == 401
    # garbage token
    bad = await client.get(
        "/api/local/config", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert bad.status_code == 401
    # a normal ACCESS token must not work as a provision token
    token = await login(client, "admin", "admin123")
    wrong_type = await client.get(
        "/api/local/config", headers={"Authorization": f"Bearer {token}"}
    )
    assert wrong_type.status_code == 401


@pytest.mark.asyncio
async def test_provision_token_requires_superadmin(
    client: httpx.AsyncClient, seeded: None
) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    quarry = await _make_quarry(client, admin)
    dept = auth_header(await login(client, "department", "dept123"))
    resp = await client.post(
        f"/api/v1/quarries/{quarry['id']}/provision-token",
        json={"server_url": "http://test"},
        headers=dept,
    )
    assert resp.status_code == 403
    await client.delete(f"/api/v1/quarries/{quarry['id']}", headers=admin)
