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
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.formparsers import MultiPartException

from app.core.config import settings
from app.db.session import get_db
from app.models.event import Event
from app.models.material import Material
from app.models.media import Media
from app.models.quarry import Camera, Post, Quarry, quarry_materials
from app.services.detection import get_detector
from app.services.plates import payer_type, split_plate
from app.services.storage import save_bytes
from app.services.trips import link_event
from app.services.volume import MaterialSpec, VolumeInput, compute_volume

router = APIRouter(tags=["weigh"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

# Uzbekistan time (UTC+5) — event_time arrives naive in this zone.
_UZ_TZ = timezone(timedelta(hours=5))


async def require_api_key(x_api_key: Annotated[str | None, Header()] = None) -> str:
    """Require the X-API-Key header. The value itself is validated in the
    handler once the payload names the quarry: either the quarry's own
    provisioned api_key or one of the global WEIGH_API_KEYS is accepted."""
    if not x_api_key:
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
    direction: str | None = None  # "in" | "out" | null (see API.md)
    # Dahua ANPR vehicle category (LargeTruck/MicroTruck/Car/Bus/...), optional.
    vtype: str | None = None
    weight: float | None = None
    unit: str = "kg"
    event_time: str
    video_path: str | None = None
    image_paths: list[str] = []
    # Lokal YOLO material taklifi (ixtiyoriy) — yakuniy qaror backendda:
    # karyerga biriktirilgan mahsulotlar ro'yxati bilan cheklanadi.
    material_id: str | None = None
    material_confidence: float | None = None


# The local server reports movement as in/out; our Event uses enter/exit.
_DIRECTION_MAP = {"in": "enter", "out": "exit"}


def _map_direction(raw: str | None) -> str:
    """in→enter, out→exit; unknown/null falls back to the model default."""
    return _DIRECTION_MAP.get((raw or "").lower(), "exit")


def _norm_vtype(cat: str | None) -> str:
    """Dahua category → our coarse vtype: light vehicles are "car", the rest
    (LargeTruck/MidTruck/MicroTruck/Bus/unknown) count as "truck"."""
    c = (cat or "").lower()
    if "car" in c or "suv" in c or "van" in c or "motor" in c or "bike" in c:
        return "car"
    return "truck"


def _parse_event_time(raw: str) -> datetime:
    """Parse `YYYY-MM-DD HH:MM:SS` (UTC+5) into a tz-aware datetime."""
    try:
        naive = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "event_time formati xato") from exc
    return naive.replace(tzinfo=_UZ_TZ)


async def _resolve_material(
    db: AsyncSession,
    quarry_id: object,
    local_id: str | None,
    local_conf: float | None,
    det_id: str | None,
    det_conf: float,
) -> tuple[Material | None, float, bool]:
    """Hodisa materialini aniqlash. Asosiy manba — karyerga biriktirilgan
    mahsulotlar ro'yxati; lokal YOLO taklifi ham, backend detektori ham shu
    ro'yxat bilan cheklanadi. Qaytaradi: (material, confidence, inspect?).

    * 1 ta biriktirilgan  → har doim o'sha (AI shart emas).
    * bir nechta          → lokal taklif ro'yxatda bo'lsa → qabul; bo'lmasa
                            detektor taklifi ro'yxatda bo'lsa → qabul (lokal
                            adashgan bo'lsa inspect); hech biri mos kelmasa →
                            birinchisi yoziladi va inspect.
    * ro'yxat bo'sh       → eski xatti-harakat: lokal taklif > detektor.
    """
    assigned = list(
        (
            await db.execute(
                select(Material)
                .join(quarry_materials, quarry_materials.c.material_id == Material.id)
                .where(quarry_materials.c.quarry_id == quarry_id)
                .order_by(Material.default_density)
            )
        )
        .scalars()
        .all()
    )

    if len(assigned) == 1:
        return assigned[0], 100.0, False

    if assigned:
        by_id = {m.id: m for m in assigned}
        if local_id and local_id in by_id:
            return by_id[local_id], float(local_conf or 0.0), False
        mismatch = bool(local_id)  # lokal taklif ro'yxatdan tashqarida
        if det_id and det_id in by_id:
            return by_id[det_id], det_conf, mismatch
        return assigned[0], 0.0, True

    for cand_id, conf in ((local_id, float(local_conf or 0.0)), (det_id, det_conf)):
        if cand_id:
            material = await db.get(Material, cand_id)
            if material is not None:
                return material, conf, False
    return None, 0.0, False


@router.get("/ping")
async def ping() -> dict[str, object]:
    """Connectivity check the local server calls on startup and periodically."""
    return {"ok": True, "server_time": datetime.now(_UZ_TZ).strftime("%Y-%m-%d %H:%M:%S")}


async def _extract(
    request: Request,
) -> tuple[WeighIn, list[tuple[bytes, str]], tuple[bytes, str] | None]:
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
async def weigh(request: Request, db: DbDep, api_key: ApiKeyDep) -> dict[str, object]:
    payload, images, video = await _extract(request)

    # Resolve the quarry by its code (e.g. "KARYER-01").
    quarry = (
        await db.execute(select(Quarry).where(Quarry.code == payload.quarry_id))
    ).scalar_one_or_none()
    if quarry is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"quarry topilmadi: {payload.quarry_id}")

    # Key must be the quarry's own provisioned api_key or a global one — a key
    # provisioned for quarry A can't post events as quarry B.
    if api_key not in settings.weigh_api_key_set and api_key != quarry.api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "X-API-Key bu karyer uchun yaroqsiz")

    # Idempotency: a retried send returns the existing row (API.md §2).
    existing = (
        await db.execute(select(Event).where(Event.event_uid == payload.event_uid))
    ).scalar_one_or_none()
    if existing is not None:
        return {
            "ok": True,
            "id": str(existing.id),
            "event_uid": payload.event_uid,
            "duplicate": True,
        }

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

    plate_region, plate_number = split_plate(payload.plate)
    weight_kg = int(payload.weight) if payload.weight else 0

    # Backend detektori (hozircha stub) — mashina modeli hamda lokal taklif
    # kelmaganda material uchun zaxira manba.
    model = ""
    det_material_id: str | None = None
    det_confidence = 0.0
    if images:
        det = get_detector().analyze(images[0][0])
        model = det.model
        det_material_id = det.material_id
        det_confidence = det.type_confidence

    # Material: karyerga biriktirilgan mahsulotlar ro'yxati asosida (lokal YOLO
    # taklifi va detektor shu ro'yxat bilan cheklanadi, mos kelmasa inspect).
    material, material_confidence, material_inspect = await _resolve_material(
        db,
        quarry.id,
        payload.material_id,
        payload.material_confidence,
        det_material_id,
        det_confidence,
    )
    material_id = material.id if material is not None else None
    density = float(material.default_density) if material is not None else 0.0
    spec = (
        MaterialSpec(lo=float(material.density_min), hi=float(material.density_max))
        if material is not None
        else MaterialSpec(lo=1.4, hi=1.7)
    )

    vol = compute_volume(VolumeInput(density=density, weight_kg=weight_kg), spec)

    # Raqam bo'sh = ANPR o'qiy olmagan → "no_plate" (chalkashlik): operator
    # dashboardda raqamni qo'lda kiritgach, event qatnovga juftlanadi.
    # Material karyer ro'yxatiga mos kelmasa → "inspect" (operator ko'radi).
    if not plate_number:
        event_status = "no_plate"
    elif material_inspect:
        event_status = "inspect"
    else:
        event_status = vol.status

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
        direction=_map_direction(payload.direction),
        occurred_at=_parse_event_time(payload.event_time),
        is_loaded=True,
        vtype=_norm_vtype(payload.vtype),
        payer_type=payer_type(plate_number),
        density=density,
        weight_kg=weight_kg,
        volume_camera=None,
        volume_scale=vol.volume_final,
        volume_final=vol.volume_final,
        diff_pct=None,
        volume_confidence=vol.confidence,
        material_confidence=material_confidence,
        status=event_status,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    _attach_media(db, event.id, images, video, payload)
    # Qatnov: kon exit → main enter → main exit zanjiriga bog'laymiz.
    trip = await link_event(db, event)
    await db.commit()

    return {
        "ok": True,
        "id": str(event.id),
        "event_uid": payload.event_uid,
        "trip_id": str(trip.id) if trip is not None else None,
    }


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
        db.add(
            Media(event_id=event_id, kind="video", path=payload.video_path, url=payload.video_path)
        )
