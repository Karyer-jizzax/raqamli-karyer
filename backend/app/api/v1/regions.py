"""Regions & districts — reference geo data + superadmin CRUD."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.region import District, Region
from app.schemas.region import (
    DistrictCreate,
    DistrictOut,
    DistrictUpdate,
    RegionCreate,
    RegionOut,
    RegionUpdate,
)
from app.schemas.stats import RegionGeo
from app.services.geo import region_geo

router = APIRouter(tags=["regions"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(require_role("superadmin"))]


async def _get_region(db: AsyncSession, region_id: UUID) -> Region:
    region = await db.get(Region, region_id)
    if region is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hudud topilmadi")
    return region


async def _get_district(db: AsyncSession, district_id: UUID) -> District:
    district = await db.get(District, district_id)
    if district is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tuman topilmadi")
    return district


# ── regions ──────────────────────────────────────────────────────────────────
@router.get("/regions", response_model=list[RegionOut])
async def list_regions(db: DbDep) -> list[Region]:
    result = await db.execute(select(Region).order_by(Region.name_uz_latn))
    return list(result.scalars().all())


@router.post("/regions", response_model=RegionOut, status_code=status.HTTP_201_CREATED)
async def create_region(body: RegionCreate, db: DbDep, _a: AdminDep) -> Region:
    region = Region(**body.model_dump())
    db.add(region)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Hududni saqlab bo'lmadi") from exc
    await db.refresh(region)
    return region


@router.patch("/regions/{region_id}", response_model=RegionOut)
async def update_region(region_id: UUID, body: RegionUpdate, db: DbDep, _a: AdminDep) -> Region:
    region = await _get_region(db, region_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(region, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Hududni saqlab bo'lmadi") from exc
    await db.refresh(region)
    return region


@router.delete("/regions/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_region(region_id: UUID, db: DbDep, _a: AdminDep) -> None:
    region = await _get_region(db, region_id)
    has_district = await db.execute(
        select(District.id).where(District.region_id == region_id).limit(1)
    )
    if has_district.first() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Avval hududdagi tumanlarni o'chiring"
        )
    await db.delete(region)
    await db.commit()


# ── districts ────────────────────────────────────────────────────────────────
@router.get("/districts", response_model=list[DistrictOut])
async def list_districts(
    db: DbDep,
    region_id: Annotated[UUID | None, Query()] = None,
) -> list[District]:
    stmt = select(District).order_by(District.name_uz_latn)
    if region_id is not None:
        stmt = stmt.where(District.region_id == region_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/districts", response_model=DistrictOut, status_code=status.HTTP_201_CREATED)
async def create_district(body: DistrictCreate, db: DbDep, _a: AdminDep) -> District:
    await _get_region(db, body.region_id)
    district = District(**body.model_dump())
    db.add(district)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Tumanni saqlab bo'lmadi") from exc
    await db.refresh(district)
    return district


@router.patch("/districts/{district_id}", response_model=DistrictOut)
async def update_district(
    district_id: UUID, body: DistrictUpdate, db: DbDep, _a: AdminDep
) -> District:
    district = await _get_district(db, district_id)
    data = body.model_dump(exclude_unset=True)
    if "region_id" in data:
        await _get_region(db, data["region_id"])
    for field, value in data.items():
        setattr(district, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Tumanni saqlab bo'lmadi") from exc
    await db.refresh(district)
    return district


@router.delete("/districts/{district_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_district(district_id: UUID, db: DbDep, _a: AdminDep) -> None:
    from app.models.quarry import Quarry

    district = await _get_district(db, district_id)
    has_quarry = await db.execute(
        select(Quarry.id).where(Quarry.district_id == district_id).limit(1)
    )
    if has_quarry.first() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Avval tumandagi karyerlarni o'chiring"
        )
    await db.delete(district)
    await db.commit()


@router.get("/regions/{region_id}/geo", response_model=RegionGeo)
async def get_region_geo(
    region_id: UUID,
    db: DbDep,
    _user: Annotated[object, Depends(get_current_user)],
) -> RegionGeo:
    data = await region_geo(db, region_id)
    return RegionGeo(**data)
