"""Weighbridge (tarozi) reading DTO."""

from pydantic import BaseModel


class ScaleReadingOut(BaseModel):
    weight_kg: int
