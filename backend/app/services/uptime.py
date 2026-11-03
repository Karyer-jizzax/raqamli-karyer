"""Agentning kunlik onlayn/oflayn statistikasi (karyer-local API.md §9).

Heartbeat har daqiqada keladi va odatda 2 kunni (bugun, kecha), uzilishdan
keyin esa 7 kunni olib keladi. Har bir kun `(quarry_id, date)` bo'yicha
UPSERT qilinadi — kun davomida raqamlar o'sib boradi, oxirgisi to'g'ri.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_uptime import AgentUptimeDaily
from app.schemas.agent import AgentUptimeDayIn

_UZ_TZ = timezone(timedelta(hours=5))

# Agent ko'pi bilan 7 kun yuboradi; undan eskisi yoki kelajakdagisi —
# soati noto'g'ri kompyuter. Bunday qatorlar jadvalni buzmasin.
_MAX_AGE_DAYS = 31
# Bitta heartbeat'da shundan ortiq kun bo'lishi kutilmaydi.
_MAX_DAYS_PER_BEAT = 14
_MAX_OUTAGES_PER_DAY = 200


def parse_days(raw: list[Any]) -> list[AgentUptimeDayIn]:
    """Heartbeat'dagi `uptime` ro'yxatini tekshirish.

    Buzuq element tashlab yuboriladi, qolganlari qabul qilinadi: heartbeat
    tirikligini bildiradi va statistika uchun uni rad etib bo'lmaydi."""
    today = datetime.now(_UZ_TZ).date()
    out: dict[date, AgentUptimeDayIn] = {}
    for item in raw[:_MAX_DAYS_PER_BEAT]:
        try:
            day = AgentUptimeDayIn.model_validate(item)
        except ValidationError:
            continue
        if day.date > today + timedelta(days=1):
            continue
        if day.date < today - timedelta(days=_MAX_AGE_DAYS):
            continue
        out[day.date] = day  # bir kun ikki marta kelsa — oxirgisi
    return list(out.values())


async def upsert_days(db: AsyncSession, quarry_id: uuid.UUID, days: list[AgentUptimeDayIn]) -> None:
    """Kunlarni yozish (commit chaqiruvchida)."""
    for day in days:
        values = {
            "covered_min": day.covered_min,
            "online_min": day.online_min,
            "net_down_min": day.net_down_min,
            "server_down_min": day.server_down_min,
            "agent_off_min": day.agent_off_min,
            "outages": [
                {"from": o.from_, "to": o.to, "min": o.min, "reason": o.reason}
                for o in day.outages[:_MAX_OUTAGES_PER_DAY]
            ],
        }
        stmt = insert(AgentUptimeDaily).values(quarry_id=quarry_id, date=day.date, **values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[AgentUptimeDaily.quarry_id, AgentUptimeDaily.date],
            set_={**values, "updated_at": datetime.now(_UZ_TZ)},
        )
        await db.execute(stmt)


async def list_days(
    db: AsyncSession,
    quarry_id: uuid.UUID,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[AgentUptimeDaily]:
    """Davrdagi kunlar, yangidan eskiga."""
    query = select(AgentUptimeDaily).where(AgentUptimeDaily.quarry_id == quarry_id)
    if date_from is not None:
        query = query.where(AgentUptimeDaily.date >= date_from)
    if date_to is not None:
        query = query.where(AgentUptimeDaily.date <= date_to)
    query = query.order_by(AgentUptimeDaily.date.desc())
    return list((await db.execute(query)).scalars().all())
