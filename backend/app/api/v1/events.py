"""Events: authoritative create, volume preview, scoped list."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.material import Material
from app.models.quarry import Camera, Post, Quarry
from app.models.region import District
from app.schemas.event import EventCreate, EventOut, VolumeInputDto, VolumeResultDto
from app.services.volume import MaterialSpec, VolumeInput, compute_volume

router = APIRouter(tags=["events"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


async def _material_spec(db: AsyncSession, material_id: str) -> tuple[Material, MaterialSpec]:
    material = await db.get(Material, material_id)
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material topilmadi")
    spec = MaterialSpec(
        lo=float(material.density_min),
        hi=float(material.density_max),
        is_tent=material.is_tent,
    )
    return material, spec


@router.post("/volume/preview", response_model=VolumeResultDto)
async def volume_preview(
    body: VolumeInputDto, _user: CurrentUser, db: DbDep
) -> VolumeResultDto:
    _material, spec = await _material_spec(db, body.material_id)
    result = compute_volume(
        VolumeInput(
            density=body.density,
            weight_kg=body.weight_kg,
            length_m=body.length_m,
            width_m=body.width_m,
            height_m=body.height_m,
        ),
        spec,
    )
    return VolumeResultDto(**result.__dict__)


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate, db: DbDep, user: Annotated[object, Depends(get_current_user)]
) -> Event:
    # Resolve quarry scope.
    if user.role == "operator":  # type: ignore[attr-defined]
        if user.quarry_id is None:  # type: ignore[attr-defined]
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Operator karyerga bog'lanmagan")
        quarry_id = user.quarry_id  # type: ignore[attr-defined]
    else:
        if body.quarry_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "quarry_id talab qilinadi")
        quarry_id = body.quarry_id

    # Default post/camera to the quarry's first ones so M1 columns are populated.
    post_id = body.post_id
    if post_id is None:
        post_id = (
            await db.execute(select(Post.id).where(Post.quarry_id == quarry_id).limit(1))
        ).scalar_one_or_none()
    camera_id = body.camera_id
    if camera_id is None and post_id is not None:
        camera_id = (
            await db.execute(select(Camera.id).where(Camera.post_id == post_id).limit(1))
        ).scalar_one_or_none()

    _material, spec = await _material_spec(db, body.material_id)
    result = compute_volume(
        VolumeInput(
            density=body.density,
            weight_kg=body.weight_kg,
            length_m=body.length_m,
            width_m=body.width_m,
            height_m=body.height_m,
        ),
        spec,
    )

    event = Event(
        quarry_id=quarry_id,
        post_id=post_id,
        camera_id=camera_id,
        material_id=body.material_id,
        created_by=user.id,  # type: ignore[attr-defined]
        plate_region=body.plate_region,
        plate_number=body.plate_number,
        model=body.model,
        direction=body.direction,
        occurred_at=body.occurred_at or datetime.now(),
        is_loaded=body.is_loaded,
        vtype=body.vtype,
        payer_type=body.payer_type,
        density=body.density,
        weight_kg=body.weight_kg,
        length_m=body.length_m,
        width_m=body.width_m,
        height_m=body.height_m,
        tent_cover_pct=body.tent_cover_pct,
        volume_camera=result.volume_camera,
        volume_scale=result.volume_scale,
        volume_final=result.volume_final,
        diff_pct=result.diff_pct,
        volume_confidence=result.confidence,
        material_confidence=body.material_confidence,
        status=result.status,
        owner_name=body.owner_name,
        stir=body.stir,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.get("/events", response_model=list[EventOut])
async def list_events(
    db: DbDep,
    user: Annotated[object, Depends(get_current_user)],
    quarry_id: Annotated[UUID | None, Query()] = None,
    event_status: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Event]:
    stmt = select(Event).order_by(Event.occurred_at.desc())

    # DB-level tenant scope — never trust the UI alone.
    role = user.role  # type: ignore[attr-defined]
    if role == "operator":
        stmt = stmt.where(Event.quarry_id == user.quarry_id)  # type: ignore[attr-defined]
    elif role == "department":
        stmt = (
            stmt.join(Quarry, Quarry.id == Event.quarry_id)
            .join(District, District.id == Quarry.district_id)
            .where(District.region_id == user.region_id)  # type: ignore[attr-defined]
        )

    if quarry_id is not None:
        stmt = stmt.where(Event.quarry_id == quarry_id)
    if event_status is not None:
        stmt = stmt.where(Event.status == event_status)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())
