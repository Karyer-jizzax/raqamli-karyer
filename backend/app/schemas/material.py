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
