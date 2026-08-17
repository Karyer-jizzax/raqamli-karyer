"""Tuman darajasidagi departament hisobi o'z tumanidan tashqarini ko'rmasligi.

Bu — UI qulayligi emas, ruxsat masalasi: ro'yxatlar server tomonida
toraytiriladi, ya'ni token bilan to'g'ridan so'ralganda ham begona tuman
ma'lumoti chiqmasligi kerak.
"""

import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete

from app.tests.conftest import auth_header, login

PASSWORD = "scope123"


@pytest_asyncio.fixture
async def district_user(
    client: httpx.AsyncClient, seeded: None
) -> AsyncGenerator[dict, None]:
    """Bitta tumanga bog'langan departament hisobi (test oxirida o'chiriladi)."""
    admin = auth_header(await login(client, "admin", "admin123"))
    districts = (await client.get("/api/v1/districts")).json()
    district = districts[0]
    username = f"scope-{uuid.uuid4().hex[:8]}"

    created = await client.post(
        "/api/v1/users",
        json={
            "username": username,
            "password": PASSWORD,
            "full_name": "Tuman inspektori",
            "role": "department",
            "district_id": district["id"],
        },
        headers=admin,
    )
    assert created.status_code == 201, created.text
    user = created.json()
    # Viloyat tumandan kelib chiqadi — forma yubormasa ham.
    assert user["region_id"] == district["region_id"]

    yield {"username": username, "district": district}

    from app.db.session import SessionLocal
    from app.models.user import User

    async with SessionLocal() as db:
        await db.execute(delete(User).where(User.username == username))
        await db.commit()


@pytest.mark.asyncio
async def test_district_user_sees_only_its_district(
    client: httpx.AsyncClient, district_user: dict
) -> None:
    district = district_user["district"]
    headers = auth_header(await login(client, district_user["username"], PASSWORD))

    me = (await client.get("/api/v1/auth/me", headers=headers)).json()
    assert me["district_id"] == district["id"]

    # Tumanlar ro'yxati — faqat o'zi, hatto boshqa viloyat so'ralganda ham.
    listed = (await client.get("/api/v1/districts", headers=headers)).json()
    assert [d["id"] for d in listed] == [district["id"]]

    # Karyerlar — hammasi shu tumandan.
    quarries = (await client.get("/api/v1/quarries", headers=headers)).json()
    assert quarries, "seed karyerlari birinchi tumanda turadi"
    assert {q["district_id"] for q in quarries} == {district["id"]}

    # Xarita ham shu tumanniki: bitta kontur.
    geo = (
        await client.get(
            f"/api/v1/regions/{district['region_id']}/geo", headers=headers
        )
    ).json()
    assert [d["id"] for d in geo["districts"]] == [district["id"]]


@pytest.mark.asyncio
async def test_district_user_is_refused_other_districts(
    client: httpx.AsyncClient, district_user: dict
) -> None:
    district = district_user["district"]
    headers = auth_header(await login(client, district_user["username"], PASSWORD))

    others = [
        d
        for d in (await client.get("/api/v1/districts")).json()
        if d["id"] != district["id"]
    ]
    assert others, "seedda bir nechta tuman bo'lishi kerak"

    # Boshqa tumanning yuki — 403, so'rovda ochiq yozilgan bo'lsa ham.
    refused = await client.get(
        f"/api/v1/stats/districts/{others[0]['id']}/cargo", headers=headers
    )
    assert refused.status_code == 403, refused.text

    # Statistika esa so'rovdagi tumanni emas, hisobdagisini oladi: begona
    # `district_id` bilan ham javob o'z tumanining raqami bo'lib qoladi.
    scoped = (
        await client.get(
            f"/api/v1/stats/overview?district_id={others[0]['id']}", headers=headers
        )
    ).json()
    own = (
        await client.get(
            f"/api/v1/stats/overview?district_id={district['id']}", headers=headers
        )
    ).json()
    assert scoped == own
