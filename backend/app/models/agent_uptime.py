"""Karyer agentining kunlik onlayn/oflayn statistikasi (karyer-local API.md §9).

Local server har daqiqada tarmoq holatini o'z bazasiga yozadi va kunlik
yig'indini heartbeat ichida (`uptime`) yuboradi. Bu yerda bitta qator =
bitta karyerning bitta kuni. Kun davomida qiymat o'sib boradi, shuning uchun
`(quarry_id, date)` bo'yicha UPSERT: oxirgi kelgani to'g'ri.

Nega server o'zi heartbeat bo'shlig'idan sanamaydi: u "internet yo'q" bilan
"kompyuter o'chiq"ni ajrata olmaydi — sababni faqat agent biladi.
"""

import uuid
from datetime import date as Day
from datetime import datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgentUptimeDaily(Base):
    __tablename__ = "agent_uptime_daily"

    quarry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quarries.id", ondelete="CASCADE"), primary_key=True
    )
    # O'zbekiston vaqtidagi kun (UTC+5) — agent shunday hisoblaydi.
    date: Mapped[Day] = mapped_column(Date, primary_key=True)

    # Hisoblangan daqiqalar: bugun uchun — hozirgacha, o'rnatilgan kuni —
    # o'rnatilgandan beri. Qolgan to'rttasining yig'indisi shunga teng.
    covered_min: Mapped[int] = mapped_column(Integer, default=0)
    online_min: Mapped[int] = mapped_column(Integer, default=0)
    net_down_min: Mapped[int] = mapped_column(Integer, default=0)
    server_down_min: Mapped[int] = mapped_column(Integer, default=0)
    agent_off_min: Mapped[int] = mapped_column(Integer, default=0)
    # [{"from": "14:12", "to": "15:49", "min": 97, "reason": "internet"}, ...]
    outages: Mapped[list | None] = mapped_column(JSON, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
