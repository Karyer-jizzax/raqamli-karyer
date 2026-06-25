"""Auth flow + role enforcement (integration; needs DB)."""

import httpx
import pytest

from app.tests.conftest import auth_header, login


@pytest.mark.asyncio
async def test_login_success_and_me(client: httpx.AsyncClient, seeded: None) -> None:
    resp = await client.post(
        "/api/v1/auth/login", json={"username": "admin", "password": "admin123"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] == "superadmin"
    assert data["access_token"] and data["refresh_token"]

    me = await client.get("/api/v1/auth/me", headers=auth_header(data["access_token"]))
    assert me.status_code == 200
    assert me.json()["username"] == "admin"


@pytest.mark.asyncio
async def test_login_wrong_password(client: httpx.AsyncClient, seeded: None) -> None:
    resp = await client.post(
        "/api/v1/auth/login", json={"username": "admin", "password": "nope"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_token(client: httpx.AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh(client: httpx.AsyncClient, seeded: None) -> None:
    login_resp = (
        await client.post(
            "/api/v1/auth/login", json={"username": "department", "password": "dept123"}
        )
    ).json()
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login_resp["refresh_token"]}
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "department"


@pytest.mark.asyncio
async def test_operator_cannot_create_quarry(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "operator", "oper123")
    districts = (await client.get("/api/v1/districts")).json()
    body = {"district_id": districts[0]["id"], "name": "X", "code": "X-TEST"}
    resp = await client.post("/api/v1/quarries", json=body, headers=auth_header(token))
    assert resp.status_code == 403
