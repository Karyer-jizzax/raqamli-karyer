"""Quarry local-server ingest — the receiving side of API.md.

The quarry-side local server captures each transport (ANPR plate + weighbridge
weight, plus photo/video) and POSTs it here. Two content types are accepted:

* Format A — `application/json` (text only; image_paths/video_path are external
  references we can't fetch, stored as-is).
* Format B — `multipart/form-data` with the `data` JSON part plus `images`
  (0..N jpg) and `video` (0..1 mp4) file parts. This is the primary flow — the
  files are saved to our media store and served under /media.

Auth: `X-API-Key` header (one key per quarry local server, see settings).
Idempotent on `event_uid`: the local server retries on failure, so a repeated
send returns the existing row instead of creating a duplicate.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, ValidationError
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.formparsers import MultiPartException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.event import Event
from app.models.material import Material
from app.models.media import Media
from app.models.quarry import Camera, Post, Quarry
from app.services.detection import get_detector
from app.services.storage import save_bytes
from app.services.volume import MaterialSpec, VolumeInput, compute_volume

router = APIRouter(tags=["weigh"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

# Uzbekistan time (UTC+5) — event_time arrives naive in this zone.
_UZ_TZ = timezone(timedelta(hours=5))


async def require_api_key(x_api_key: Annotated[str | None, Header()] = None) -> str:
    """Validate the X-API-Key header against the configured key set."""
    if not x_api_key or x_api_key not in settings.weigh_api_key_set:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing X-API-Key")
    return x_api_key


ApiKeyDep = Annotated[str, Depends(require_api_key)]


class WeighIn(BaseModel):
    """The `data` payload (API.md §4)."""

    event_uid: str
    quarry_id: str
    camera_name: str
    is_main: bool
    plate: str | None = None
    weight: float | None = None
    unit: str = "kg"
    event_time: str
    video_path: str | None = None
    image_paths: list[str] = []


def _parse_event_time(raw: str) -> datetime:
    """Parse `YYYY-MM-DD HH:MM:SS` (UTC+5) into a tz-aware datetime."""
    try:
        naive = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "event_time formati xato") from exc
    return naive.replace(tzinfo=_UZ_TZ)


def _split_plate(plate: str | None) -> tuple[str, str]:
    """`01S748HE` -> ('01', 'S748HE'). Region = leading digits (max 3)."""
    if not plate:
        return "", ""
    plate = plate.strip().upper()
    i = 0
    while i < len(plate) and i < 3 and plate[i].isdigit():
        i += 1
    return plate[:i], plate[i:]


@router.get("/ping")
async def ping() -> dict[str, object]:
    """Connectivity check the local server calls on startup and periodically."""
    return {"ok": True, "server_time": datetime.now(_UZ_TZ).strftime("%Y-%m-%d %H:%M:%S")}


async def _extract(request: Request) -> tuple[WeighIn, list[tuple[bytes, str]], tuple[bytes, str] | None]:
    """Return (payload, [(image_bytes, suffix)], (video_bytes, suffix)|None)."""
    content_type = request.headers.get("content-type", "")
    images: list[tuple[bytes, str]] = []
    video: tuple[bytes, str] | None = None

    if content_type.startswith("multipart/form-data"):
        # Raise the per-part cap well above 1MB — the local server sends a ~10s
        # H.264 clip plus jpg snapshots that would trip Starlette's default.
        max_bytes = settings.weigh_max_upload_mb * 1024 * 1024
        try:
            form = await request.form(max_part_size=max_bytes)
        except MultiPartException as exc:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"Fayl juda katta (limit {settings.weigh_max_upload_mb}MB): {exc}",
            ) from exc
        raw = form.get("data")
        try:
            payload_dict = json.loads(raw) if isinstance(raw, str) else {}
        except json.JSONDecodeError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "data JSON xato") from exc
        for part in (*form.getlist("images"), *form.getlist("image")):
            if isinstance(part, StarletteUploadFile):
                suffix = os.path.splitext(part.filename or "")[1] or ".jpg"
                images.append((await part.read(), suffix))
        vpart = form.get("video")
        if isinstance(vpart, StarletteUploadFile):
            suffix = os.path.splitext(vpart.filename or "")[1] or ".mp4"
            video = (await vpart.read(), suffix)
    else:
        try:
            payload_dict = await request.json()
        except json.JSONDecodeError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "JSON xato") from exc

    try:
        payload = WeighIn(**payload_dict)
    except ValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Payload xato: {exc.errors()}") from exc
    return payload, images, video


@router.post("/weigh")
async def weigh(request: Request, db: DbDep, _key: ApiKeyDep) -> dict[str, object]:
    payload, images, video = await _extract(request)

    # Idempotency: a retried send returns the existing row (API.md §2).
    existing = (
        await db.execute(select(Event).where(Event.event_uid == payload.event_uid))
    ).scalar_one_or_none()
    if existing is not None:
        return {"ok": True, "id": str(existing.id), "event_uid": payload.event_uid, "duplicate": True}

    # Resolve the quarry by its code (e.g. "KARYER-01").
    quarry = (
        await db.execute(select(Quarry).where(Quarry.code == payload.quarry_id))
    ).scalar_one_or_none()
    if quarry is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"quarry topilmadi: {payload.quarry_id}")

    # Resolve the camera by name/code within the quarry; fall back to first post.
    cam = (
        await db.execute(
            select(Camera)
            .join(Post, Post.id == Camera.post_id)
            .where(Post.quarry_id == quarry.id)
            .where(or_(Camera.name == payload.camera_name, Camera.code == payload.camera_name))
            .limit(1)
        )
    ).scalar_one_or_none()
    if cam is not None:
        post_id, camera_id = cam.post_id, cam.id
    else:
        post_id = (
            await db.execute(select(Post.id).where(Post.quarry_id == quarry.id).limit(1))
        ).scalar_one_or_none()
        camera_id = None

    plate_region, plate_number = _split_plate(payload.plate)
    weight_kg = int(payload.weight) if payload.weight else 0

    # The local server sends plate + weight but NOT material — recognise the
    # material from the first snapshot so volume can be computed. (Stub for now;
    # swap services.detection for a real model — nothing here changes.)
    model = ""
    material_id: str | None = None
    material_confidence = 0.0
    density = 0.0
    spec = MaterialSpec(lo=1.4, hi=1.7)
    if images:
        det = get_detector().analyze(images[0][0])
        model, material_id, material_confidence = det.model, det.material_id, det.type_confidence
        material = await db.get(Material, material_id)
        if material is not None:
            density = float(material.default_density)
            spec = MaterialSpec(lo=float(material.density_min), hi=float(material.density_max))

    vol = compute_volume(VolumeInput(density=density, weight_kg=weight_kg), spec)

    event = Event(
        event_uid=payload.event_uid,
        quarry_id=quarry.id,
        post_id=post_id,
        camera_id=camera_id,
        material_id=material_id,
        is_main=payload.is_main,
        plate_region=plate_region,
        plate_number=plate_number,
        model=model,
        direction="exit",
        occurred_at=_parse_event_time(payload.event_time),
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
        material_confidence=material_confidence,
        status=vol.status,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    _attach_media(db, event.id, images, video, payload)
    await db.commit()

    return {"ok": True, "id": str(event.id), "event_uid": payload.event_uid}


def _attach_media(
    db: AsyncSession,
    event_id: object,
    images: list[tuple[bytes, str]],
    video: tuple[bytes, str] | None,
    payload: WeighIn,
) -> None:
    """Persist uploaded files (Format B) or record external paths (Format A)."""
    if images or video:
        for data, suffix in images:
            path, url = save_bytes(data, suffix)
            db.add(Media(event_id=event_id, kind="photo", path=path, url=url))
        if video is not None:
            path, url = save_bytes(video[0], video[1])
            db.add(Media(event_id=event_id, kind="video", path=path, url=url))
        return
    # Format A: no bytes, only external references — store them for traceability.
    for p in payload.image_paths:
        db.add(Media(event_id=event_id, kind="photo", path=p, url=p))
    if payload.video_path:
        db.add(Media(event_id=event_id, kind="video", path=payload.video_path, url=payload.video_path))
