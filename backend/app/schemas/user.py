"""User management DTOs (superadmin)."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

Role = Literal["superadmin", "department", "operator"]


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str = ""
    email: str | None = None
    role: Role = "operator"
    quarry_id: UUID | None = None
    region_id: UUID | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    is_active: bool | None = None
    quarry_id: UUID | None = None
    region_id: UUID | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str | None
    full_name: str
    role: str
    is_active: bool
    quarry_id: UUID | None
    region_id: UUID | None
