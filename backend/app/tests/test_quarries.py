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
    post_id = post.json()["id"]

    renamed = await client.patch(
        f"/api/v1/posts/{post_id}", json={"name": "Kirish posti"}, headers=headers
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Kirish posti"

    # nested camera (plate + record on the same post/pole)
    plate_cam = await client.post(
        f"/api/v1/posts/{post_id}/cameras",
        json={"code": f"C-{uuid.uuid4().hex[:6]}", "name": "Raqam kamerasi", "kind": "plate"},
        headers=headers,
    )
    assert plate_cam.status_code == 201
    record_cam = await client.post(
        f"/api/v1/posts/{post_id}/cameras",
        json={"code": f"C-{uuid.uuid4().hex[:6]}", "name": "Video kamerasi", "kind": "record"},
        headers=headers,
    )
    assert record_cam.status_code == 201
    camera_id = record_cam.json()["id"]

    cameras = await client.get(f"/api/v1/posts/{post_id}/cameras", headers=headers)
    assert len(cameras.json()) == 2

    updated_cam = await client.patch(
        f"/api/v1/cameras/{camera_id}",
        json={"stream_url": "rtsp://example/stream", "is_active": False},
        headers=headers,
    )
    assert updated_cam.status_code == 200
    assert updated_cam.json()["stream_url"] == "rtsp://example/stream"
    assert updated_cam.json()["is_active"] is False

    deleted_cam = await client.delete(f"/api/v1/cameras/{camera_id}", headers=headers)
    assert deleted_cam.status_code == 204

    deleted_post = await client.delete(f"/api/v1/posts/{post_id}", headers=headers)
    assert deleted_post.status_code == 204

    # cleanup
    deleted = await client.delete(f"/api/v1/quarries/{quarry_id}", headers=headers)
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_camera_name_and_code_unique_within_quarry(
    client: httpx.AsyncClient, seeded: None
) -> None:
    """Bir karyer ichida (boshqa postda ham) bir xil kamera name/code → 409:
    weigh ingest kamerani karyer bo'yicha qidiradi, dublikat chalkashtiradi."""
    token = await login(client, "admin", "admin123")
    headers = auth_header(token)

    district_id = (await client.get("/api/v1/districts")).json()[0]["id"]
    quarry = (
        await client.post(
            "/api/v1/quarries",
            json={
                "district_id": district_id,
                "name": "Kamera karyer",
                "code": f"Q-{uuid.uuid4().hex[:8]}",
            },
            headers=headers,
        )
    ).json()
    posts = []
    for n in (1, 2):
        resp = await client.post(
            f"/api/v1/quarries/{quarry['id']}/posts",
            json={"code": f"P-{uuid.uuid4().hex[:6]}", "name": f"Post {n}"},
            headers=headers,
        )
        posts.append(resp.json()["id"])

    first = await client.post(
        f"/api/v1/posts/{posts[0]}/cameras",
        json={"code": "CAM-1", "name": "Raqam kamerasi", "kind": "plate"},
        headers=headers,
    )
    assert first.status_code == 201, first.text

    # Xuddi shu nom — boshqa postda ham taqiqlanadi.
    dup_name = await client.post(
        f"/api/v1/posts/{posts[1]}/cameras",
        json={"code": "CAM-2", "name": "Raqam kamerasi", "kind": "plate"},
        headers=headers,
    )
    assert dup_name.status_code == 409

    # Xuddi shu kod ham taqiqlanadi.
    dup_code = await client.post(
        f"/api/v1/posts/{posts[1]}/cameras",
        json={"code": "CAM-1", "name": "Boshqa nom", "kind": "plate"},
        headers=headers,
    )
    assert dup_code.status_code == 409

    second = await client.post(
        f"/api/v1/posts/{posts[1]}/cameras",
        json={"code": "CAM-2", "name": "Video kamerasi", "kind": "record"},
        headers=headers,
    )
    assert second.status_code == 201, second.text
    second_id = second.json()["id"]

    # Tahrirda mavjud nomga o'zgartirish → 409; o'z nomini qayta yozish → 200.
    rename_dup = await client.patch(
        f"/api/v1/cameras/{second_id}", json={"name": "Raqam kamerasi"}, headers=headers
    )
    assert rename_dup.status_code == 409
    rename_self = await client.patch(
        f"/api/v1/cameras/{second_id}", json={"name": "Video kamerasi"}, headers=headers
    )
    assert rename_self.status_code == 200

    # cleanup
    deleted = await client.delete(f"/api/v1/quarries/{quarry['id']}", headers=headers)
    assert deleted.status_code == 204
