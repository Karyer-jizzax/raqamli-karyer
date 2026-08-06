"""Tarozi punkti agenti — bitta karyerga bitta agent (doc.txt §2–3).

Karyerdagi local dastur (Windows) tarozi va kamerani o'qiydi, hodisalarni
serverga yuboradi. Bu jadval uchta narsani saqlaydi:

* **token** — agentning yagona autentifikatsiyasi (`Authorization: Bearer`).
  Adminkadan qayta generatsiya/bekor qilinadi; bekor qilingan token bilan
  kelgan so'rov 401 oladi.
* **sozlama** (§3.2) — agent har 60 soniyada GET /api/agent/config orqali
  o'qiydi, ya'ni adminkadan turib masofadan sozlash shu ustunlar orqali.
* **oxirgi heartbeat** (§3.3) — agent holati (tarozi, kameralar, navbat,
  kanal tezligi). Tarix saqlanmaydi: karyer sahifasi faqat "hozir qanday"ni
  ko'rsatadi.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# doc.txt §4.1 profillari + "auto" (§4.2). "snapshot" — jonli video o'rniga
# JPEG kadr; "off" — agent jonli ko'rinishni umuman yubormaydi.
VIDEO_QUALITIES = ("auto", "snapshot", "low", "medium", "high")

# Token prefiksi — jurnalda/skrinshotda darhol ko'rinsin nima ekani.
TOKEN_PREFIX = "KRY_"

# Agent "online" hisoblanadigan oyna: doc §2.2 bo'yicha 2 daqiqa, lekin
# heartbeat intervali kattalashtirilsa oyna ham kengayadi (aks holda o'z
# sozlamasi bilan doim "offline" ko'rinardi).
_MIN_ONLINE_WINDOW_SEC = 120


class QuarryAgent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quarry_agents"

    quarry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quarries.id", ondelete="CASCADE"), unique=True, index=True
    )

    # ── token (§2) ────────────────────────────────────────────────────────
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    token_issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # NULL = amalda; to'ldirilgan bo'lsa token bekor qilingan (401).
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── sozlama (§3.2) ────────────────────────────────────────────────────
    video_quality: Mapped[str] = mapped_column(String(16), default="auto")
    # Profil jadvalini (§4.1) karyer uchun qo'lda o'zgartirish; NULL = standart.
    quality_profiles_override: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    live_stream_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    event_pre_seconds: Mapped[int] = mapped_column(Integer, default=5)
    event_post_seconds: Mapped[int] = mapped_column(Integer, default=5)
    min_event_weight_kg: Mapped[int] = mapped_column(Integer, default=500)
    stable_seconds: Mapped[int] = mapped_column(Integer, default=3)
    heartbeat_interval_sec: Mapped[int] = mapped_column(Integer, default=60)

    # ── oxirgi heartbeat (§3.3) ───────────────────────────────────────────
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    agent_version: Mapped[str] = mapped_column(String(32), default="")
    scale_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    # [{"id": "cam1", "ok": true}, ...] — agent nima ko'rsa o'shani yozamiz.
    cameras: Mapped[list | None] = mapped_column(JSON, nullable=True)
    queue_size: Mapped[int] = mapped_column(Integer, default=0)
    upload_kbps_avg: Mapped[int] = mapped_column(Integer, default=0)
    live_streaming: Mapped[bool] = mapped_column(Boolean, default=False)
    current_quality: Mapped[str] = mapped_column(String(16), default="")

    @property
    def is_online(self) -> bool:
        """Oxirgi heartbeat oynasi ichida ko'ringanmi (§2.2)."""
        if self.last_seen_at is None:
            return False
        window = max(_MIN_ONLINE_WINDOW_SEC, 2 * (self.heartbeat_interval_sec or 60))
        last_seen = self.last_seen_at
        if last_seen.tzinfo is None:  # SQLite/nayb ustun — UTC deb o'qiymiz
            last_seen = last_seen.replace(tzinfo=UTC)
        return datetime.now(UTC) - last_seen <= timedelta(seconds=window)

    @property
    def is_active(self) -> bool:
        """Token amaldami (bekor qilinmaganmi)."""
        return self.revoked_at is None

    def config_payload(self) -> dict[str, object]:
        """GET /api/agent/config javobi — doc.txt §3.2 sxemasi aynan."""
        return {
            "video_quality": self.video_quality,
            "quality_profiles_override": self.quality_profiles_override,
            "live_stream_enabled": self.live_stream_enabled,
            "event_pre_seconds": self.event_pre_seconds,
            "event_post_seconds": self.event_post_seconds,
            "min_event_weight_kg": self.min_event_weight_kg,
            "stable_seconds": self.stable_seconds,
            "heartbeat_interval_sec": self.heartbeat_interval_sec,
        }
