"""Quarry / post / camera DTOs."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

QuarryStatus = Literal["active", "suspended"]
CameraKind = Literal["plate", "record"]


class QuarryCreate(BaseModel):
    district_id: UUID
    name: str
    code: str
    organization_id: UUID | None = None
    status: QuarryStatus = "active"


class QuarryUpdate(BaseModel):
    name: str | None = None
    status: QuarryStatus | None = None
    organization_id: UUID | None = None


class QuarryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    district_id: UUID
    organization_id: UUID | None
    name: str
    code: str
    status: str


class PostCreate(BaseModel):
    code: str
    name: str


class PostUpdate(BaseModel):
    name: str | None = None


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quarry_id: UUID
    code: str
    name: str


class CameraCreate(BaseModel):
    code: str
    name: str
    kind: CameraKind = "plate"
    stream_url: str | None = None


class CameraUpdate(BaseModel):
    name: str | None = None
    stream_url: str | None = None
    is_active: bool | None = None


class QuarryMaterialsUpdate(BaseModel):
    material_ids: list[str]


class ProvisionTokenRequest(BaseModel):
    # Public backend origin the local server should call (web-main knows the
    # API base it talks to; the backend can't reliably guess it behind proxies).
    server_url: str


class ProvisionTokenOut(BaseModel):
    token: str
    expires_hours: int
    quarry_code: str


class CameraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    post_id: UUID
    code: str
    name: str
    kind: str
    stream_url: str | None
    is_active: bool
