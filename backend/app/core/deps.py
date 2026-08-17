"""Auth + tenant-scope dependencies.

Scope is enforced at the DB-query level (not just the UI). `require_role`
gates by role; `scoped_quarry_ids` / `scoped_region_id` narrow queries so an
operator only ever sees their quarry and a department only their region.
"""

from collections.abc import Callable, Coroutine
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str) -> Callable[..., Coroutine[Any, Any, User]]:
    async def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user

    return checker


async def list_users_in_scope(db: AsyncSession, user: User) -> list[User]:
    """Example scope helper kept for symmetry; superadmin sees all."""
    if user.role == "superadmin":
        return list((await db.execute(select(User))).scalars().all())
    return [user]


# ── tenant scope ─────────────────────────────────────────────────────────────
# A department account names either a viloyat (region_id) or a single tuman
# inside it (district_id). The district is the narrower of the two, so once it
# is set every query narrows to it and the region is only a fallback. Both are
# read from the DB row, never from a request parameter.


def scoped_region_id(user: User) -> UUID | None:
    """The region a department user is locked to; None for everyone else."""
    if user.role == "department":
        return user.region_id
    return None


def scoped_district_id(user: User) -> UUID | None:
    """The tuman a department user is locked to, if the account names one."""
    if user.role == "department":
        return user.district_id
    return None


def ensure_region_scope(user: User, region_id: UUID | None) -> None:
    if scoped_region_id(user) is not None and region_id != user.region_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Boshqa viloyat ma'lumotiga ruxsat yo'q")


def ensure_district_scope(user: User, region_id: UUID | None, district_id: UUID | None) -> None:
    """Region check first, then the tuman one — a district user is inside a
    region, so a wrong region is the more informative refusal."""
    ensure_region_scope(user, region_id)
    locked = scoped_district_id(user)
    if locked is not None and district_id != locked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Boshqa tuman ma'lumotiga ruxsat yo'q")


async def ensure_quarry_scope(db: AsyncSession, user: User, quarry: object) -> None:
    """Same rule as the list endpoints, for a single quarry: operator → own
    quarry, department → own region and (when set) own tuman."""
    from app.models.region import District  # local import: avoids a cycle

    role = user.role
    if role == "operator":
        if quarry.id != user.quarry_id:  # type: ignore[attr-defined]
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Boshqa karyer")
        return
    if role != "department":
        return
    district_id = quarry.district_id  # type: ignore[attr-defined]
    region_id = (
        await db.execute(select(District.region_id).where(District.id == district_id))
    ).scalar_one_or_none()
    ensure_district_scope(user, region_id, district_id)
