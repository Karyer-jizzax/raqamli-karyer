"""Quarry local-server provisioning — GET /api/local/config.

The local server (dahua_anpr_local_server) exchanges a provision token
(issued in web-main, see /quarries/{id}/provision-token) for its full
configuration: quarry code, ingest api_key and the camera names the server
expects. This kills the manual copy step — a wrong quarry_id or a
misspelled camera_name can no longer happen.

Auth: `Authorization: Bearer <provision-jwt>` (type="provision").
"""

from typing import Annotated
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.db.session import get_db
from app.models.quarry import Post, Quarry

router = APIRouter(tags=["local"])

_bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[AsyncSession, Depends(get_db)]


async def _quarry_from_token(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: DbDep,
) -> tuple[Quarry, str]:
    """Validate the provision JWT and return (quarry, server_url claim)."""
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token yo'q")
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "provision":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token turi xato")
        quarry_id = UUID(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Token muddati o'tgan — web-main'dan yangisini oling"
        ) from exc
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token yaroqsiz") from exc

    quarry = await db.get(Quarry, quarry_id)
    if quarry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Karyer topilmadi")
    return quarry, str(payload.get("url") or "")


@router.get("/local/config")
async def local_config(
    ctx: Annotated[tuple[Quarry, str], Depends(_quarry_from_token)], db: DbDep
) -> dict[str, object]:
    """The local server's config.json seed — see local README / API.md."""
    quarry, server_url = ctx
    posts = (
        (
            await db.execute(
                select(Post)
                .where(Post.quarry_id == quarry.id)
                .options(selectinload(Post.cameras))
                .order_by(Post.created_at)
            )
        )
        .scalars()
        .all()
    )
    return {
        "quarry_id": quarry.code,
        "quarry_name": quarry.name,
        "server": {
            "url": server_url,
            "api_key": quarry.api_key or "",
            "endpoint": "/api/weigh",
            "enabled": True,
            "send_files": True,
        },
        # camera_name the local server sends must match one of these (weigh
        # resolves Camera by name OR code within the quarry).
        "cameras": [
            {
                "post_code": p.code,
                "post_name": p.name,
                "code": c.code,
                "name": c.name,
                "kind": c.kind,
                "brand": c.brand or "dahua",
                "ip": c.ip or "",
                "login": c.login or "",
                "password": c.password or "",
                "stream_url": c.stream_url or "",
                "is_active": c.is_active,
            }
            for p in posts
            for c in p.cameras
        ],
    }
