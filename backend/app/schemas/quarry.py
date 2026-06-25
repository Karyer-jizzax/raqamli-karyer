"""Quarry / post / camera DTOs."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

QuarryStatus = Literal["active", "suspended"]
CameraKind = Literal["plate", "volume"]


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


class CameraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    post_id: UUID
    code: str
    name: str
    kind: str
    stream_url: str | None
    is_active: bool
