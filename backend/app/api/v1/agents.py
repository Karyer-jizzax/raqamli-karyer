"""Adminka tomoni: agent tokeni, sozlamasi, holati va jonli kadr (doc.txt §2.2, §3.5).

Agentning o'zi `app.api.agent` bilan gaplashadi; bu yerda sayt foydalanuvchisi
uchun bo'lgan qism: token berish/bekor qilish, sozlama formasi, "online/offline"
kartasi va snapshot rejimidagi jonli kadr.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, ensure_quarry_scope, require_role
from app.db.session import get_db
from app.models.agent import QuarryAgent
from app.models.quarry import Camera, Post, Quarry
from app.models.user import User
from app.schemas.agent import AgentConfigOut, AgentConfigUpdate, AgentStatusOut, LiveStreamOut
from app.services.agents import get_agent, issue_token, revoke_token
from app.services.live import get_snapshot, hls_url, webrtc_url

router = APIRouter(tags=["agents"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(require_role("superadmin"))]


async def _quarry_in_scope(db: AsyncSession, user: User, quarry_id: UUID) -> Quarry:
    """Karyerni ko'rish huquqi — ro'yxatlardagi bilan bir xil qoida: operator
    faqat o'z karyerini, departament o'z viloyatini (tumanga bog'langan bo'lsa
    — o'z tumanini) ko'radi."""
    quarry = await db.get(Quarry, quarry_id)
    if quarry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Karyer topilmadi")
    await ensure_quarry_scope(db, user, quarry)
    return quarry


def _live_mode(agent: QuarryAgent | None) -> str:
    """Sayt qaysi ko'rinishni chizishi kerak (doc §3.5).

    Agent offline bo'lsa yoki jonli ko'rinish o'chirilgan bo'lsa — "off":
    "yuklanmoqda" spinner bilan abadiy kutishdan ko'ra, holatni aytgan
    yaxshi."""
    if agent is None or not agent.is_active or not agent.is_online:
        return "off"
    if not agent.live_stream_enabled:
        return "off"
    if agent.current_quality == "snapshot":
        return "snapshot"
    return "hls" if agent.live_streaming else "off"


async def _cameras(
    db: AsyncSession, agent: QuarryAgent | None, quarry_id: UUID
) -> list[tuple[str, str, str]]:
    """`(identifikator, ko'rinadigan nom, post nomi)` uchliklari.

    Identifikator — avval agent heartbeat'da aytganlari (jonli haqiqat),
    bo'lmasa bazadagi kamera kodlari. U MediaMTX yo'li va snapshot kaliti,
    shuning uchun agent yuborgani bilan aynan bir xil qolishi shart.

    Nom esa adminkada berilgani: sahifada "DAHUASBJN" emas, "Kirish kamerasi"
    turishi kerak. Agent kamerani nomi yoki kodi bilan atashi mumkin
    (`services.ingest.resolve_camera` bilan bir xil qoida), shuning uchun
    ikkalasi ham kalit sifatida qidiriladi. Topilmasa — identifikatorning
    o'zi: ro'yxatdan tushib qolgan kamera nomsiz emas, hech bo'lmasa
    kodi bilan ko'rinsin (posti esa noma'lum, ya'ni bo'sh).

    Post nomi — kameralar devorini guruhlash va filtrlash uchun: karyerda
    nechta post bo'lsa, jonli ko'rinish ham shuncha bo'limga bo'linadi.
    Shu sababli tartib ham postdan boshlanadi.
    """
    rows = (
        await db.execute(
            select(Camera.code, Camera.name, Camera.is_active, Post.name)
            .join(Post, Post.id == Camera.post_id)
            .where(Post.quarry_id == quarry_id)
            .order_by(Post.code, Camera.created_at)
        )
    ).all()
    known: dict[str, tuple[str, str]] = {}
    order: dict[str, int] = {}
    for i, (code, name, _active, post) in enumerate(rows):
        known[code] = known[name] = (name, post)
        order[code] = order[name] = i

    reported = [
        str(c["id"])
        for c in (agent.cameras or [])
        if isinstance(c, dict) and c.get("id")
    ] if agent is not None else []
    if reported:
        # Agent aytgan tartib emas, bazadagi post tartibi: heartbeat ro'yxati
        # ixtiyoriy kelishi mumkin va ekrandagi kartalar joyini almashtirib
        # tursa, operator ko'zi bilan topgan kamerasini qaytadan qidiradi.
        # Bazada yo'q kamera oxirida, o'zaro nomi bo'yicha.
        reported.sort(key=lambda cam: (order.get(cam, len(rows)), cam))
        return [(cam, *known.get(cam, (cam, ""))) for cam in reported]
    return [(code, name, post) for code, name, active, post in rows if active]


async def _status_out(
    db: AsyncSession, quarry: Quarry, agent: QuarryAgent | None, *, with_token: bool
) -> AgentStatusOut:
    mode = _live_mode(agent)
    cameras = await _cameras(db, agent, quarry.id)
    streams = [
        LiveStreamOut(
            camera_id=cam,
            camera_name=name,
            post_name=post,
            hls_url=hls_url(quarry.code, cam) if mode == "hls" else None,
            webrtc_url=webrtc_url(quarry.code, cam) if mode == "hls" else None,
            snapshot_url=f"/api/v1/live-snapshot/{quarry.id}/{cam}",
        )
        for cam, name, post in cameras
    ]
    if agent is None:
        return AgentStatusOut(quarry_id=str(quarry.id), live_mode="off", streams=streams)
    return AgentStatusOut(
        quarry_id=str(quarry.id),
        token=agent.token if with_token else None,
        token_issued_at=agent.token_issued_at,
        revoked_at=agent.revoked_at,
        is_active=agent.is_active,
        online=agent.is_online,
        last_seen_at=agent.last_seen_at,
        agent_version=agent.agent_version,
        scale_ok=agent.scale_ok,
        cameras=agent.cameras or [],
        queue_size=agent.queue_size,
        upload_kbps_avg=agent.upload_kbps_avg,
        live_streaming=agent.live_streaming,
        current_quality=agent.current_quality,
        config=AgentConfigOut(**agent.config_payload()),
        live_mode=mode,
        streams=streams,
    )


@router.get("/quarries/{quarry_id}/agent", response_model=AgentStatusOut)
async def get_quarry_agent(quarry_id: UUID, user: CurrentUser, db: DbDep) -> AgentStatusOut:
    """Karyer sahifasidagi agent kartasi. Token faqat superadminga ko'rinadi."""
    quarry = await _quarry_in_scope(db, user, quarry_id)
    agent = await get_agent(db, quarry_id)
    return await _status_out(db, quarry, agent, with_token=user.role == "superadmin")


@router.post("/quarries/{quarry_id}/agent/token", response_model=AgentStatusOut)
async def create_agent_token(quarry_id: UUID, user: CurrentUser, db: DbDep, _a: AdminDep):
    """Token berish yoki qayta generatsiya qilish — eski token darhol o'ladi."""
    quarry = await _quarry_in_scope(db, user, quarry_id)
    agent = await issue_token(db, quarry_id)
    return await _status_out(db, quarry, agent, with_token=True)


@router.delete("/quarries/{quarry_id}/agent/token", response_model=AgentStatusOut)
async def delete_agent_token(quarry_id: UUID, user: CurrentUser, db: DbDep, _a: AdminDep):
    """Tokenni bekor qilish (§2.2) — agent so'rovlari 401 ola boshlaydi."""
    quarry = await _quarry_in_scope(db, user, quarry_id)
    agent = await get_agent(db, quarry_id)
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bu karyerda agent yo'q")
    await revoke_token(db, agent)
    return await _status_out(db, quarry, agent, with_token=True)


@router.put("/quarries/{quarry_id}/agent/config", response_model=AgentStatusOut)
async def update_agent_config(
    quarry_id: UUID, body: AgentConfigUpdate, user: CurrentUser, db: DbDep, _a: AdminDep
):
    """Masofadan sozlash — agent keyingi config so'rovida (≤60s) qabul qiladi."""
    quarry = await _quarry_in_scope(db, user, quarry_id)
    agent = await get_agent(db, quarry_id)
    if agent is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Avval agent tokenini bering"
        )
    for field, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return await _status_out(db, quarry, agent, with_token=True)


@router.get("/live-snapshot/{quarry_id}/{camera_id}", response_class=Response)
async def live_snapshot(
    quarry_id: UUID, camera_id: str, user: CurrentUser, db: DbDep
) -> Response:
    """Snapshot rejimidagi oxirgi kadr (doc §3.4). Sayt har 2-3 soniyada
    so'raydi, shuning uchun keshlanmaydi."""
    await _quarry_in_scope(db, user, quarry_id)
    snap = get_snapshot(str(quarry_id), camera_id)
    if snap is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kadr yo'q")
    return Response(
        content=snap.data,
        media_type=snap.content_type,
        headers={
            "Cache-Control": "no-store",
            # Sayt kadr necha soniyalik ekanini ko'rsatishi uchun.
            "X-Snapshot-Age": str(int(snap.age_seconds)),
            "X-Snapshot-Fresh": "1" if snap.is_fresh else "0",
        },
    )
