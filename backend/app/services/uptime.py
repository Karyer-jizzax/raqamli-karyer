"""Agentning kunlik onlayn/oflayn statistikasi (karyer-local API.md §9).

Heartbeat har daqiqada keladi va odatda 2 kunni (bugun, kecha), uzilishdan
keyin esa 7 kunni olib keladi. Har bir kun `(quarry_id, date)` bo'yicha
UPSERT qilinadi — kun davomida raqamlar o'sib boradi, oxirgisi to'g'ri.
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta, timezone
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


async def list_days_many(
    db: AsyncSession,
    quarry_ids: list[uuid.UUID],
    date_from: date,
    date_to: date,
) -> dict[uuid.UUID, list[AgentUptimeDaily]]:
    """Bir nechta karyerning davrdagi kunlari — bitta so'rovda, karyer
    bo'yicha guruhlangan (har birida yangidan eskiga)."""
    out: dict[uuid.UUID, list[AgentUptimeDaily]] = {qid: [] for qid in quarry_ids}
    if not quarry_ids:
        return out
    query = (
        select(AgentUptimeDaily)
        .where(
            AgentUptimeDaily.quarry_id.in_(quarry_ids),
            AgentUptimeDaily.date >= date_from,
            AgentUptimeDaily.date <= date_to,
        )
        .order_by(AgentUptimeDaily.quarry_id, AgentUptimeDaily.date.desc())
    )
    for row in (await db.execute(query)).scalars().all():
        out.setdefault(row.quarry_id, []).append(row)
    return out


def today_uz() -> date:
    return datetime.now(_UZ_TZ).date()


def pending_offline_minutes(
    last_seen: datetime,
    date_from: date | None,
    date_to: date | None,
    now: datetime | None = None,
) -> dict[date, int]:
    """Agent hozir oflayn: oxirgi heartbeat'dan hozirgacha bo'lgan vaqt,
    O'zbekiston kunlari bo'yicha daqiqada.

    Oflayn paytda agent statistika yubora olmaydi — u uzilishni qayta
    ulanganda yuboradi. Usiz sahifa "3 soatdan beri oflayn" deb turib,
    davr ustunida 100% onlayn ko'rsatardi. Agent qayta ulanib haqiqiy
    raqamlarni yuborgach, bu qo'shimcha o'z-o'zidan yo'qoladi (karyer
    onlayn bo'ladi)."""
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=UTC)
    start = last_seen.astimezone(_UZ_TZ)
    end = (now or datetime.now(UTC)).astimezone(_UZ_TZ)
    out: dict[date, int] = {}
    day = start.date()
    while day <= end.date():
        if (date_from is None or day >= date_from) and (date_to is None or day <= date_to):
            d0 = datetime.combine(day, time.min, _UZ_TZ)
            d1 = d0 + timedelta(days=1)
            minutes = int((min(end, d1) - max(start, d0)).total_seconds() // 60)
            if minutes > 0:
                out[day] = minutes
        day += timedelta(days=1)
    return out


def day_elapsed_min(day: date, now: datetime | None = None) -> int:
    """Kunning hozirgacha o'tgan daqiqalari (o'tgan kun uchun 1440)."""
    end = (now or datetime.now(UTC)).astimezone(_UZ_TZ)
    if day < end.date():
        return 1440
    if day > end.date():
        return 0
    return end.hour * 60 + end.minute
