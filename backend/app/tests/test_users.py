"""Departament hisobini o'chirish — adminka tugmasi ortidagi shartnoma.

O'chirish qaytarib bo'lmaydigan amal, shuning uchun ikki narsa tekshiriladi:
o'chirilgan hisob ro'yxatdan butunlay yo'qoladi va admin o'zini o'chira olmaydi
(aks holda tizim egasiz qolardi).
"""

import uuid

import httpx
import pytest

from app.tests.conftest import auth_header, login


async def _create_department(client: httpx.AsyncClient, admin: dict) -> dict:
    resp = await client.post(
        "/api/v1/users",
        json={
            "username": f"del-{uuid.uuid4().hex[:8]}",
            "password": "delete123",
            "full_name": "O'chiriladigan hisob",
            "role": "department",
        },
        headers=admin,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_delete_user_removes_it_from_the_registry(
    client: httpx.AsyncClient, seeded: None
) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    user = await _create_department(client, admin)

    deleted = await client.delete(f"/api/v1/users/{user['id']}", headers=admin)
    assert deleted.status_code == 204, deleted.text

    listed = (await client.get("/api/v1/users", headers=admin)).json()
    assert all(u["id"] != user["id"] for u in listed)

    # Ikkinchi marta bosilsa — endi yo'q.
    again = await client.delete(f"/api/v1/users/{user['id']}", headers=admin)
    assert again.status_code == 404


@pytest.mark.asyncio
async def test_admin_cannot_delete_itself(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    me = (await client.get("/api/v1/auth/me", headers=admin)).json()

    resp = await client.delete(f"/api/v1/users/{me['id']}", headers=admin)
    assert resp.status_code == 409

    still_there = await client.get("/api/v1/auth/me", headers=admin)
    assert still_there.status_code == 200


@pytest.mark.asyncio
async def test_department_cannot_delete_users(client: httpx.AsyncClient, seeded: None) -> None:
    admin = auth_header(await login(client, "admin", "admin123"))
    victim = await _create_department(client, admin)
    try:
        dep = auth_header(await login(client, "department", "dept123"))
        resp = await client.delete(f"/api/v1/users/{victim['id']}", headers=dep)
        assert resp.status_code == 403
    finally:
        await client.delete(f"/api/v1/users/{victim['id']}", headers=admin)
