"""Shared test fixtures.

Auth/quarry tests are integration tests: they need the PostGIS DB up and
migrated (docker compose up -d db && alembic upgrade head). If the DB is
unreachable the fixtures skip rather than fail the whole suite.

Testlar bitta doimiy bazada ishlaydi (har safar yangisi yaratilmaydi), shuning
uchun o'zidan keyin tozalash muhim — ayniqsa **kelajak sanali** hodisalar
(qatnov oynasi testlari ataylab `now + N daqiqa` yozadi). Ular yig'ilib borsa,
hodisalar ro'yxatining birinchi sahifasini egallab, boshqa testlarni yiqitadi.
Shuning uchun quyidagi yordamchilar bor va ular test modullaridagi autouse
fixture'lardan chaqiriladi.
"""

from collections.abc import AsyncGenerator
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport
from sqlalchemy import delete, or_, select

from app.main import app


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def seeded() -> None:
    """Ensure demo users/districts exist; skip the test if DB is down.

    Each test runs in a fresh event loop, so dispose the shared async engine
    first to drop pooled connections bound to a previous (closed) loop.
    """
    from app.db.session import engine
    from scripts.seed import seed

    try:
        await engine.dispose()
        await seed()
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"DB unavailable: {exc}")


async def login(client: httpx.AsyncClient, username: str, password: str) -> str:
    resp = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def purge_events(event_ids: list[UUID | str]) -> None:
    """Shu hodisalarni va ular ochgan qatnov/mediani o'chirish.

    Kalit sifatida hodisa `id`si ishlatiladi (raqam emas): raqamsiz kelgan
    hodisalar ham, keyin raqami tuzatilganlari ham bir xil tozalanadi.
    FK tartibi: qatnov → media → hodisa."""
    if not event_ids:
        return
    from app.db.session import SessionLocal
    from app.models.event import Event
    from app.models.media import Media
    from app.models.trip import Trip

    ids = [UUID(str(e)) for e in event_ids]
    async with SessionLocal() as db:
        await db.execute(
            delete(Trip).where(
                or_(
                    Trip.kon_enter_event_id.in_(ids),
                    Trip.kon_exit_event_id.in_(ids),
                    Trip.main_enter_event_id.in_(ids),
                    Trip.main_exit_event_id.in_(ids),
                )
            )
        )
        await db.execute(delete(Media).where(Media.event_id.in_(ids)))
        await db.execute(delete(Event).where(Event.id.in_(ids)))
        await db.commit()


async def purge_quarries(quarry_ids: list[UUID | str]) -> None:
    """Test yaratgan karyerni butunlay o'chirish (hodisa, media, qatnov,
    agent, post/kamera bilan). Aks holda har ishga tushirishda adminkadagi
    karyerlar ro'yxati soxta qatorlar bilan o'sib boradi."""
    if not quarry_ids:
        return
    from app.db.session import SessionLocal
    from app.models.event import Event
    from app.models.media import Media
    from app.models.quarry import Quarry
    from app.models.trip import Trip

    ids = [UUID(str(q)) for q in quarry_ids]
    async with SessionLocal() as db:
        event_ids = list(
            (await db.execute(select(Event.id).where(Event.quarry_id.in_(ids)))).scalars().all()
        )
        await db.execute(delete(Trip).where(Trip.quarry_id.in_(ids)))
        if event_ids:
            await db.execute(delete(Media).where(Media.event_id.in_(event_ids)))
            await db.execute(delete(Event).where(Event.id.in_(event_ids)))
        await db.commit()
        # Postlar/kameralar ORM cascade bilan, agent qatori FK ondelete bilan.
        for quarry in (
            (await db.execute(select(Quarry).where(Quarry.id.in_(ids)))).scalars().all()
        ):
            await db.delete(quarry)
        await db.commit()
