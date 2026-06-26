"""Region / district DTOs."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str


class RegionCreate(BaseModel):
    code: str
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str


class RegionUpdate(BaseModel):
    code: str | None = None
    name_uz_latn: str | None = None
    name_uz_cyrl: str | None = None
    name_ru: str | None = None


class DistrictOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    region_id: UUID
    code: str
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str
    is_capital: bool


class DistrictCreate(BaseModel):
    region_id: UUID
    code: str
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str
    is_capital: bool = False


class DistrictUpdate(BaseModel):
    region_id: UUID | None = None
    code: str | None = None
    name_uz_latn: str | None = None
    name_uz_cyrl: str | None = None
    name_ru: str | None = None
    is_capital: bool | None = None
