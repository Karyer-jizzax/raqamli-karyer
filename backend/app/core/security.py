"""Password hashing + JWT helpers."""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def _encode(subject: str, token_type: str, expires: timedelta, claims: dict[str, Any]) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expires,
        "type": token_type,
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, claims: dict[str, Any] | None = None) -> str:
    return _encode(
        subject,
        "access",
        timedelta(minutes=settings.access_token_expire_minutes),
        claims or {},
    )


def create_refresh_token(subject: str) -> str:
    return _encode(subject, "refresh", timedelta(days=settings.refresh_token_expire_days), {})


def create_provision_token(quarry_id: str, server_url: str) -> str:
    """One paste-able token the quarry local server uses to fetch its config.

    Carries the public server URL as a claim so the local server learns where
    to call GET /api/local/config from the token alone (single-field setup).
    """
    return _encode(
        quarry_id,
        "provision",
        timedelta(hours=settings.provision_token_expire_hours),
        {"url": server_url},
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
