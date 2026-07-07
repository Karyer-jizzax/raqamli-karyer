"""Shared test fixtures.

Auth/quarry tests are integration tests: they need the PostGIS DB up and
migrated (docker compose up -d db && alembic upgrade head). If the DB is
unreachable the fixtures skip rather than fail the whole suite.
"""

from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport

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
