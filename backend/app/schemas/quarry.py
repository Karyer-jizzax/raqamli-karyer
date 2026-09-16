"""Quarry / post / camera DTOs."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

QuarryStatus = Literal["active", "suspended"]
CameraKind = Literal["plate", "record"]
CameraBrand = Literal["dahua", "hikvision"]
# Nazorat nuqtasining zanjirdagi o'rni — models.quarry.POST_ROLES bilan bir xil.
PostRole = Literal["kon", "kon_kirish", "kon_chiqish", "tarozi", "drabilka"]
PostDirection = Literal["enter", "exit"]


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
    # None = rol belgilanmagan: hodisa turi eskicha, local server yuborgan
    # `is_main` bo'yicha aniqlanadi.
    role: PostRole | None = None
    default_direction: PostDirection | None = None
    debounce_seconds: int = Field(default=0, ge=0, le=3600)


class PostUpdate(BaseModel):
    name: str | None = None
    role: PostRole | None = None
    default_direction: PostDirection | None = None
    debounce_seconds: int | None = Field(default=None, ge=0, le=3600)


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quarry_id: UUID
    code: str
    name: str
    role: str | None = None
    default_direction: str | None = None
    debounce_seconds: int = 0


class CameraCreate(BaseModel):
    code: str
    name: str
    kind: CameraKind = "plate"
    stream_url: str | None = None
    brand: CameraBrand = "dahua"
    ip: str | None = None
    login: str | None = None
    password: str | None = None


class CameraUpdate(BaseModel):
    name: str | None = None
    stream_url: str | None = None
    is_active: bool | None = None
    brand: CameraBrand | None = None
    ip: str | None = None
    login: str | None = None
    password: str | None = None


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
    brand: str
    ip: str | None
    login: str | None
    password: str | None
