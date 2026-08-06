"""Agent tokeni — berish, qidirish, bekor qilish (doc.txt §2).

Token karyerni bildiradi: agentning har bir so'rovi shu token bilan keladi va
server tokendan karyerni aniqlaydi — alohida "bog'lash" jadvali kerak emas.
Karyerga bitta agent to'g'ri keladi, shuning uchun qayta generatsiya eski
qatorni yangilaydi (yangi qator ochmaydi): eski token o'sha zahoti ishlamay
qoladi.
"""

import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import TOKEN_PREFIX, QuarryAgent


def new_token() -> str:
    """`KRY_` + 43 belgi tasodifiy (doc: kamida 32 belgi)."""
    return f"{TOKEN_PREFIX}{secrets.token_urlsafe(32)}"


async def get_agent(db: AsyncSession, quarry_id: UUID) -> QuarryAgent | None:
    return (
        await db.execute(select(QuarryAgent).where(QuarryAgent.quarry_id == quarry_id))
    ).scalar_one_or_none()


async def agent_by_token(db: AsyncSession, token: str) -> QuarryAgent | None:
    """Amaldagi agent tokeni bo'yicha. Bekor qilingan token None qaytaradi."""
    if not token:
        return None
    agent = (
        await db.execute(select(QuarryAgent).where(QuarryAgent.token == token))
    ).scalar_one_or_none()
    if agent is None or not agent.is_active:
        return None
    return agent


async def issue_token(db: AsyncSession, quarry_id: UUID) -> QuarryAgent:
    """Karyer uchun yangi token: birinchi marta yaratadi yoki almashtiradi.

    Almashtirilganda bekor qilish belgisi olib tashlanadi — "bekor qilingan
    agentni qayta ishga tushirish" alohida amal emas, yangi token berishning
    o'zi."""
    agent = await get_agent(db, quarry_id)
    if agent is None:
        agent = QuarryAgent(quarry_id=quarry_id, token=new_token())
        db.add(agent)
    else:
        agent.token = new_token()
        agent.revoked_at = None
    agent.token_issued_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(agent)
    return agent


async def revoke_token(db: AsyncSession, agent: QuarryAgent) -> QuarryAgent:
    """Tokenni bekor qilish — eski token bilan kelgan so'rov 401 oladi."""
    agent.revoked_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(agent)
    return agent
