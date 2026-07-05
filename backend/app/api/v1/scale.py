"""Weighbridge (tarozi) reading — stands in for a real scale API integration."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.schemas.scale import ScaleReadingOut
from app.services.scale import read_weight_kg

router = APIRouter(prefix="/scale", tags=["scale"])


@router.get("/reading", response_model=ScaleReadingOut)
async def get_scale_reading(
    _user: Annotated[object, Depends(get_current_user)],
    plate_region: Annotated[str, Query()],
    plate_number: Annotated[str, Query()],
) -> ScaleReadingOut:
    return ScaleReadingOut(weight_kg=read_weight_kg(plate_region, plate_number))
