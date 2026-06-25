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


class DistrictOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    region_id: UUID
    code: str
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str
    is_capital: bool
