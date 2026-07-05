"""Video / AI detection endpoints.

`analyze` runs detection on an optional uploaded frame (no save). `ingest`
runs detection AND auto-creates an event (the demo's auto-save flow), with
volume recomputed authoritatively and the frame linked as media.
"""

import os
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.material import Material
from app.models.media import Media
from app.models.quarry import Camera, Post
from app.schemas.video import AnalyzeResponse, DetectionOut, IngestResponse
from app.services.detection import DetectionResult, get_detector
from app.services.scale import read_weight_kg
from app.services.storage import save_bytes
from app.services.volume import MaterialSpec, VolumeInput, compute_volume

router = APIRouter(prefix="/video", tags=["video"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[object, Depends(get_current_user)]


def _detection_out(d: DetectionResult) -> DetectionOut:
    return DetectionOut(
        plate_region=d.plate_region,
        plate_number=d.plate_number,
        model=d.model,
        material_id=d.material_id,
        bbox=list(d.bbox),
        plate_confidence=d.plate_confidence,
        type_confidence=d.type_confidence,
    )


async def _read_and_store(file: UploadFile | None) -> tuple[bytes | None, str | None, str | None]:
    if file is None:
        return None, None, None
    data = await file.read()
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"
    path, url = save_bytes(data, suffix)
    return data, path, url


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    db: DbDep,
    _user: UserDep,
    file: Annotated[UploadFile | None, File()] = None,
) -> AnalyzeResponse:
    data, path, url = await _read_and_store(file)
    result = get_detector().analyze(data)

    media_id = None
    if path and url:
        media = Media(kind="frame", path=path, url=url)
        db.add(media)
        await db.commit()
        await db.refresh(media)
        media_id = media.id

    return AnalyzeResponse(detection=_detection_out(result), media_id=media_id, media_url=url)


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest(
    db: DbDep,
    user: UserDep,
    file: Annotated[UploadFile | None, File()] = None,
    post_id: Annotated[UUID | None, Form()] = None,
    camera_id: Annotated[UUID | None, Form()] = None,
) -> IngestResponse:
    if user.role != "operator" or user.quarry_id is None:  # type: ignore[attr-defined]
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Faqat karyerga bog'langan operator ingest qila oladi"
        )
    quarry_id = user.quarry_id  # type: ignore[attr-defined]

    # Default to the quarry's first post/camera if the operator's screen didn't
    # know which physical camera captured the frame (mirrors events.create_event).
    if post_id is None:
        post_id = (
            await db.execute(select(Post.id).where(Post.quarry_id == quarry_id).limit(1))
        ).scalar_one_or_none()
    if camera_id is None and post_id is not None:
        camera_id = (
            await db.execute(select(Camera.id).where(Camera.post_id == post_id).limit(1))
        ).scalar_one_or_none()

    data, path, url = await _read_and_store(file)
    det = get_detector().analyze(data)

    material = await db.get(Material, det.material_id)
    spec = MaterialSpec(
        lo=float(material.density_min) if material else 1.4,
        hi=float(material.density_max) if material else 1.7,
    )
    density = float(material.default_density) if material else 1.5
    weight_kg = read_weight_kg(det.plate_region, det.plate_number)
    vol = compute_volume(VolumeInput(density=density, weight_kg=weight_kg), spec)

    event = Event(
        quarry_id=quarry_id,
        post_id=post_id,
        camera_id=camera_id,
        created_by=user.id,  # type: ignore[attr-defined]
        material_id=det.material_id,
        plate_region=det.plate_region,
        plate_number=det.plate_number,
        model=det.model,
        direction="exit",
        occurred_at=datetime.now(),
        is_loaded=True,
        vtype="truck",
        payer_type="legal",
        density=density,
        weight_kg=weight_kg,
        volume_camera=None,
        volume_scale=vol.volume_final,
        volume_final=vol.volume_final,
        diff_pct=None,
        volume_confidence=vol.confidence,
        material_confidence=det.type_confidence,
        status=vol.status,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    if path and url:
        db.add(Media(event_id=event.id, kind="frame", path=path, url=url))
        await db.commit()

    return IngestResponse(event=event, detection=_detection_out(det), media_url=url)
