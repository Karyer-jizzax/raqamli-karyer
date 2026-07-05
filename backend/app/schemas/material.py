"""Pydantic DTOs for materials."""

from pydantic import BaseModel, ConfigDict


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    default_density: float
    density_min: float
    density_max: float
    is_tent: bool
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str


class MaterialCreate(BaseModel):
    id: str
    default_density: float
    density_min: float
    density_max: float
    is_tent: bool = False
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str


class MaterialUpdate(BaseModel):
    default_density: float | None = None
    density_min: float | None = None
    density_max: float | None = None
    is_tent: bool | None = None
    name_uz_latn: str | None = None
    name_uz_cyrl: str | None = None
    name_ru: str | None = None
