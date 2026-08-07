"""Tarozi punkti agenti — qabul qiluvchi tomon (doc.txt §3).

Karyerdagi local dastur (Windows) tarozini o'qiydi, kameradan kadr va klip
kesadi va shu endpointlarga yuboradi. Barcha so'rovlar
`Authorization: Bearer <agent-token>` bilan keladi; token karyerni bildiradi.

Nima uchun hodisa va video **alohida** yuboriladi (§3.1 va §3.1a): karyerda
kanal 144 kbps bo'lishi mumkin. Hodisa JSON + foto (~150 KB) bir necha
soniyada yetadi — operator raqamni fotodan darhol o'qiy oladi; 10 soniyalik
klip esa daqiqalab yuklanadi. Bitta so'rovga qo'shsak, operator butun klipni
kutib o'tirardi.

Yo'nalish (kirish/chiqish) bu punktda o'lchanmaydi — agent faqat vaznni
biladi. Shuning uchun hodisa qatnov (Trip) zanjiriga ulanmaydi: soxta
"yakunlangan qatnov" yasashdan ko'ra, hodisani M-1 jurnalida vazn bilan
ko'rsatib, raqamni operator kiritishi to'g'riroq.
"""

import contextlib
import json
import os
from datetime import UTC, datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.formparsers import MultiPartException

from app.core.config import settings
from app.db.session import get_db
from app.models.agent import QuarryAgent
from app.models.event import Event
from app.models.media import Media
from app.models.quarry import Quarry
from app.schemas.agent import AgentEventIn, AgentHeartbeatIn
from app.services.agents import agent_by_token
from app.services.detection import get_detector
from app.services.ingest import resolve_camera, resolve_material
from app.services.live import (
    publish_url,
    publish_url_template,
    put_snapshot,
    stream_path,
    stream_path_template,
)
from app.services.plates import split_plate
from app.services.storage import save_bytes
from app.services.volume import MaterialSpec, VolumeInput, compute_volume

router = APIRouter(tags=["agent"])

_bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[AsyncSession, Depends(get_db)]

# Vaqt zonasi ko'rsatilmagan bo'lsa — O'zbekiston vaqti (UTC+5).
_UZ_TZ = timezone(timedelta(hours=5))


async def require_agent(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: DbDep,
) -> QuarryAgent:
    """Agent tokenini tekshirish. Bekor qilingan/notanish token → 401 (§2.2)."""
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Agent tokeni yo'q")
    agent = await agent_by_token(db, creds.credentials)
    if agent is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Agent tokeni yaroqsiz")
    return agent


AgentDep = Annotated[QuarryAgent, Depends(require_agent)]


def _aware(moment: datetime) -> datetime:
    """Vaqt zonasiz kelgan vaqtni UTC+5 deb o'qiymiz (agent shu zonada)."""
    return moment if moment.tzinfo is not None else moment.replace(tzinfo=_UZ_TZ)


async def _read_limited(request: Request, max_mb: int, what: str) -> bytes:
    """Tanani limitgacha o'qish; oshsa 413 (oqim to'xtatiladi)."""
    limit = max_mb * 1024 * 1024
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, f"{what} {max_mb}MB dan katta"
        )
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status.HTTP_413_CONTENT_TOO_LARGE, f"{what} {max_mb}MB dan katta"
            )
        chunks.append(chunk)
    return b"".join(chunks)


# ── 3.1 hodisa qabul qilish ────────────────────────────────────────────────
@router.post("/agent/events")
async def receive_event(
    request: Request, response: Response, db: DbDep, agent: AgentDep
) -> dict[str, object]:
    """`multipart/form-data`: `event` (JSON) + `photo` (image/jpeg, majburiy).

    Idempotent `event_id` bo'yicha: offline navbat qayta yuborsa `200` va
    dublikat yozilmaydi; yangi hodisa `201`."""
    payload, photo = await _extract_event(request)

    # Idempotentlik (§3.1): takroriy yuborish mavjud qatorni qaytaradi.
    existing = (
        await db.execute(select(Event).where(Event.event_uid == payload_uid(payload)))
    ).scalar_one_or_none()
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return {
            "ok": True,
            "id": str(existing.id),
            "event_id": payload.event_id,
            "duplicate": True,
            "video_pending": existing.video_pending,
        }

    post_id, camera_id = await resolve_camera(db, agent.quarry_id, payload.camera_id)

    # Foto ustidan backend detektori (hozircha stub) — model va material uchun
    # zaxira manba; qaror baribir karyer mahsulotlari ro'yxati bilan cheklanadi.
    det = get_detector().analyze(photo[0])
    material, material_confidence, material_inspect = await resolve_material(
        db, agent.quarry_id, payload.material_id, None, det.material_id, det.type_confidence
    )
    density = float(material.default_density) if material is not None else 0.0
    spec = (
        MaterialSpec(lo=float(material.density_min), hi=float(material.density_max))
        if material is not None
        else MaterialSpec(lo=1.4, hi=1.7)
    )
    vol = compute_volume(VolumeInput(density=density, weight_kg=payload.weight_kg), spec)

    plate_region, plate_number = split_plate(payload.vehicle_number)
    if not plate_number:
        # ANPR yo'q — odatiy holat: operator fotodan/videodan o'qib kiritadi.
        event_status = "no_plate"
    elif not payload.weight_stable or material_inspect:
        # Barqarorlashmagan vazn — o'lchov ishonchsiz, operator ko'rsin.
        event_status = "inspect"
    else:
        event_status = vol.status

    event = Event(
        event_uid=payload_uid(payload),
        quarry_id=agent.quarry_id,
        post_id=post_id,
        camera_id=camera_id,
        material_id=material.id if material is not None else None,
        is_main=True,
        source="agent",
        plate_region=plate_region,
        plate_number=plate_number,
        model=det.model,
        # Yo'nalish o'lchanmaydi (modul izohiga qarang).
        direction="unknown",
        occurred_at=_aware(payload.occurred_at),
        density=density,
        weight_kg=int(payload.weight_kg),
        volume_camera=None,
        volume_scale=vol.volume_final,
        volume_final=vol.volume_final,
        volume_confidence=vol.confidence,
        material_confidence=material_confidence,
        status=event_status,
    )
    db.add(event)
    await db.flush()
    path, url = save_bytes(photo[0], photo[1])
    db.add(Media(event_id=event.id, kind="photo", path=path, url=url))
    await db.commit()

    response.status_code = status.HTTP_201_CREATED
    return {
        "ok": True,
        "id": str(event.id),
        "event_id": payload.event_id,
        "duplicate": False,
        "video_pending": True,
    }


def payload_uid(payload: AgentEventIn) -> UUID:
    """`event_id` — idempotentlik kaliti; UUID bo'lishi shart (§3.1)."""
    try:
        return UUID(payload.event_id)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "event_id UUID bo'lishi kerak"
        ) from exc


async def _extract_event(request: Request) -> tuple[AgentEventIn, tuple[bytes, str]]:
    """`event` JSON va majburiy `photo` qismini ajratib olish."""
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "multipart/form-data kutilgan"
        )
    max_bytes = settings.agent_max_photo_mb * 1024 * 1024
    try:
        form = await request.form(max_part_size=max_bytes)
    except MultiPartException as exc:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"Fayl juda katta (limit {settings.agent_max_photo_mb}MB): {exc}",
        ) from exc

    raw = form.get("event")
    try:
        payload = AgentEventIn(**(json.loads(raw) if isinstance(raw, str) else {}))
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "event JSON xato") from exc
    except ValidationError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"event maydonlari xato: {exc.errors()}"
        ) from exc

    part = form.get("photo")
    if not isinstance(part, StarletteUploadFile):
        # Sekin internetda operator raqamni fotodan o'qiydi — usiz hodisa
        # ko'r bo'lib qoladi, shuning uchun majburiy (§3.1).
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "photo qismi majburiy")
    suffix = os.path.splitext(part.filename or "")[1] or ".jpg"
    return payload, (await part.read(), suffix)


# ── 3.1a hodisa videosi ────────────────────────────────────────────────────
@router.put("/agent/events/{event_id}/video")
async def upload_event_video(
    event_id: UUID, request: Request, db: DbDep, agent: AgentDep
) -> dict[str, object]:
    """Klipni alohida yuklash. Idempotent: qayta PUT eski faylni almashtiradi
    (uzilib qolgan yuklash boshidan takrorlanadi)."""
    event = (
        await db.execute(
            select(Event).where(
                Event.event_uid == event_id, Event.quarry_id == agent.quarry_id
            )
        )
    ).scalar_one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bunday event_id yo'q")

    data = await _read_limited(request, settings.agent_max_video_mb, "Video")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Video bo'sh")

    # Eskisini almashtiramiz — chala yuklangan fayl diskda qolib ketmasin.
    old = (
        (await db.execute(select(Media).where(Media.event_id == event.id, Media.kind == "video")))
        .scalars()
        .all()
    )
    for media in old:
        with contextlib.suppress(OSError):
            os.remove(media.path)
        await db.delete(media)

    path, url = save_bytes(data, ".mp4")
    db.add(Media(event_id=event.id, kind="video", path=path, url=url))
    await db.commit()
    return {"ok": True, "event_id": str(event_id), "video_url": url}


# ── 3.2 sozlama ────────────────────────────────────────────────────────────
@router.get("/agent/config")
async def agent_config(db: DbDep, agent: AgentDep) -> dict[str, object]:
    """Agent har 60 soniyada so'raydi — adminkadagi o'zgarish shu orqali yetadi.

    `live_stream` bloki doc §3.2 sxemasiga qo'shimcha: MediaMTX manzilini
    ham shu yerdan beramiz, aks holda uni har bir karyerda qo'lda yozish
    kerak bo'lardi. Server sozlanmagan bo'lsa `null` — agent snapshot
    rejimida ishlayveradi."""
    quarry = await db.get(Quarry, agent.quarry_id)
    code = quarry.code if quarry is not None else str(agent.quarry_id)
    cameras = [c.get("id") for c in (agent.cameras or []) if isinstance(c, dict) and c.get("id")]
    return {
        **agent.config_payload(),
        "live_stream": {
            # Bitta kamerali agent shuni o'zgarishsiz ishlatadi.
            "push_url": publish_url(code, cameras[0] if cameras else "cam1"),
            # Bir nechta kamera bo'lsa `{camera_id}` o'rniga o'z nomini qo'yadi.
            "push_url_template": publish_url_template(code),
            "path_template": stream_path_template(code),
            # Eng ishonchli yo'l: heartbeat'da aytilgan har bir kamera uchun
            # tayyor manzil. Shablonni to'ldirishda registr yoki belgi farqi
            # bo'lsa, agent va sayt boshqa-boshqa yo'lni ko'rsatib qolardi.
            "cameras": {
                cam: {
                    "path": stream_path(code, cam),
                    "push_url": publish_url(code, cam),
                }
                for cam in cameras
            },
        },
    }


# ── 3.3 holat ──────────────────────────────────────────────────────────────
@router.post("/agent/heartbeat")
async def heartbeat(body: AgentHeartbeatIn, db: DbDep, agent: AgentDep) -> dict[str, object]:
    """Agent tirikligi va sifat holati — karyer sahifasida ko'rsatiladi."""
    agent.last_seen_at = datetime.now(UTC)
    agent.agent_version = body.agent_version[:32]
    agent.scale_ok = body.scale_ok
    agent.cameras = [c.model_dump() for c in body.cameras]
    agent.queue_size = body.queue_size
    agent.upload_kbps_avg = body.upload_kbps_avg
    agent.live_streaming = body.live_streaming
    agent.current_quality = body.current_quality[:16]
    await db.commit()
    return {
        "ok": True,
        "server_time": datetime.now(_UZ_TZ).isoformat(timespec="seconds"),
        # Sozlama o'zgargan bo'lsa agent alohida so'rov qilmasin.
        "config": agent.config_payload(),
    }


# ── 3.4 jonli kadr (sekin internet) ────────────────────────────────────────
@router.post("/agent/live-snapshot", status_code=status.HTTP_204_NO_CONTENT)
async def live_snapshot(
    request: Request,
    db: DbDep,
    agent: AgentDep,
    x_camera_id: Annotated[str | None, Header()] = None,
) -> Response:
    """Tana: `image/jpeg` (~20-30 KB). Faqat xotirada saqlanadi — sayt uni
    `GET /api/v1/live-snapshot/{quarry_id}/{camera_id}` orqali oladi."""
    data = await _read_limited(request, settings.agent_max_photo_mb, "Kadr")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Kadr bo'sh")
    put_snapshot(
        str(agent.quarry_id),
        (x_camera_id or "cam1").strip(),
        data,
        request.headers.get("content-type", "image/jpeg").split(";")[0],
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
