"""Regions & districts — reference geo data (full GeoJSON arrives in Faza 3)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.region import District, Region
from app.schemas.region import DistrictOut, RegionOut
from app.schemas.stats import RegionGeo
from app.services.geo import region_geo

router = APIRouter(tags=["regions"])


@router.get("/regions", response_model=list[RegionOut])
async def list_regions(db: Annotated[AsyncSession, Depends(get_db)]) -> list[Region]:
    result = await db.execute(select(Region).order_by(Region.name_uz_latn))
    return list(result.scalars().all())


@router.get("/districts", response_model=list[DistrictOut])
async def list_districts(
    db: Annotated[AsyncSession, Depends(get_db)],
    region_id: Annotated[UUID | None, Query()] = None,
) -> list[District]:
    stmt = select(District).order_by(District.name_uz_latn)
    if region_id is not None:
        stmt = stmt.where(District.region_id == region_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/regions/{region_id}/geo", response_model=RegionGeo)
async def get_region_geo(
    region_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[object, Depends(get_current_user)],
) -> RegionGeo:
    data = await region_geo(db, region_id)
    return RegionGeo(**data)
