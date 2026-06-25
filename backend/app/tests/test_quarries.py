"""Quarry CRUD as superadmin (integration; needs DB)."""

import uuid

import httpx
import pytest

from app.tests.conftest import auth_header, login


@pytest.mark.asyncio
async def test_quarry_crud(client: httpx.AsyncClient, seeded: None) -> None:
    token = await login(client, "admin", "admin123")
    headers = auth_header(token)

    districts = (await client.get("/api/v1/districts")).json()
    assert len(districts) == 13
    district_id = districts[0]["id"]

    code = f"Q-{uuid.uuid4().hex[:8]}"
    create = await client.post(
        "/api/v1/quarries",
        json={"district_id": district_id, "name": "Test karyer", "code": code},
        headers=headers,
    )
    assert create.status_code == 201, create.text
    quarry_id = create.json()["id"]

    listed = await client.get("/api/v1/quarries", headers=headers)
    assert any(q["id"] == quarry_id for q in listed.json())

    # nested post
    post = await client.post(
        f"/api/v1/quarries/{quarry_id}/posts",
        json={"code": f"P-{uuid.uuid4().hex[:6]}", "name": "Post 1"},
        headers=headers,
    )
    assert post.status_code == 201

    # cleanup
    deleted = await client.delete(f"/api/v1/quarries/{quarry_id}", headers=headers)
    assert deleted.status_code == 204
