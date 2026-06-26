"""Authentication endpoints: login, refresh, me."""

from typing import Annotated
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _access_claims(user: User) -> dict[str, object]:
    return {
        "role": user.role,
        "quarry_id": str(user.quarry_id) if user.quarry_id else None,
        "region_id": str(user.region_id) if user.region_id else None,
    }


async def _tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), _access_claims(user)),
        refresh_token=create_refresh_token(str(user.id)),
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]
) -> TokenResponse:
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login yoki parol noto'g'ri")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Foydalanuvchi faol emas")
    return await _tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]
) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from exc

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return await _tokens(user)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Joriy parol noto'g'ri")
    if len(body.new_password) < 4:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yangi parol juda qisqa")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return None


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    # Stateless JWT — client discards tokens. (Token blacklist optional later.)
    return None
