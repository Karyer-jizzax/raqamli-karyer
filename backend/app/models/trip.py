"""Trip (qatnov) — one vehicle's linked journey through the checkpoints.

Vehicle type 1 (karyer tashuvchisi): kon enter (karyerga bo'sh kirdi)
→ kon exit (karyerdan chiqdi, yuk bilan) → main enter (zavod tarozisiga
chiqdi, brutto) → main exit (bo'shatib chiqdi, tara). Netto = enter − exit.

Vehicle type 2 (tashqi mashina, kon_exit yo'q): main enter (bo'sh keldi, tara)
→ main exit (mahsulot bilan chiqdi, brutto). Netto = exit − enter.

Rows are created/updated incrementally by `services.trips.link_event` as
events arrive from the local server — never by the client directly.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.event import Event


class Trip(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "trips"

    quarry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quarries.id"), index=True)

    # vehicle snapshot (matched by plate across checkpoints)
    plate_region: Mapped[str] = mapped_column(String(8))
    plate_number: Mapped[str] = mapped_column(String(16), index=True)

    # karyer = kon chiqishidan boshlangan (material olib keladi);
    # tashqi = zavodga to'g'ridan-to'g'ri kelgan (mahsulot olib ketadi)
    kind: Mapped[str] = mapped_column(String(16), default="karyer")
    # open = davom etmoqda; done = yakunlangan (main exit bilan);
    # incomplete = keyingi hodisa kelmay eskirgan/almashtirilgan (huquqbuzarlik);
    # no_cargo = yakunlangan, lekin netto < trip_min_netto_kg (yuk emas)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)

    # linked checkpoint events
    kon_enter_event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id"), nullable=True
    )
    kon_exit_event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id"), nullable=True
    )
    main_enter_event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id"), nullable=True
    )
    main_exit_event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id"), nullable=True
    )

    # weighbridge readings (kg); None until the event arrives or if unweighed
    enter_weight_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exit_weight_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # material amount (kg), always >= 0: karyer = enter−exit, tashqi = exit−enter
    netto_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Linked events (selectin — loads safely under async, no lazy IO on access).
    kon_enter_event: Mapped[Event | None] = relationship(
        "Event", foreign_keys=[kon_enter_event_id], lazy="selectin", viewonly=True
    )
    kon_exit_event: Mapped[Event | None] = relationship(
        "Event", foreign_keys=[kon_exit_event_id], lazy="selectin", viewonly=True
    )
    main_enter_event: Mapped[Event | None] = relationship(
        "Event", foreign_keys=[main_enter_event_id], lazy="selectin", viewonly=True
    )
    main_exit_event: Mapped[Event | None] = relationship(
        "Event", foreign_keys=[main_exit_event_id], lazy="selectin", viewonly=True
    )

    # Per-stage timestamps for the UI table (TripOut reads these).
    @property
    def kon_enter_at(self) -> datetime | None:
        return self.kon_enter_event.occurred_at if self.kon_enter_event else None

    @property
    def kon_exit_at(self) -> datetime | None:
        return self.kon_exit_event.occurred_at if self.kon_exit_event else None

    @property
    def main_enter_at(self) -> datetime | None:
        return self.main_enter_event.occurred_at if self.main_enter_event else None

    @property
    def main_exit_at(self) -> datetime | None:
        return self.main_exit_event.occurred_at if self.main_exit_event else None

    # Per-stage media (linked event's ANPR snapshots + clip) for the UI modal.
    # Event.media is selectin too, so it chain-loads with the trips query.
    @staticmethod
    def _stage(ev: Event | None) -> dict | None:
        if ev is None:
            return None
        return {
            "event_id": ev.id,
            "occurred_at": ev.occurred_at,
            "image_urls": ev.image_urls,
            "video_url": ev.video_url,
        }

    @property
    def kon_enter(self) -> dict | None:
        return self._stage(self.kon_enter_event)

    @property
    def kon_exit(self) -> dict | None:
        return self._stage(self.kon_exit_event)

    @property
    def main_enter(self) -> dict | None:
        return self._stage(self.main_enter_event)

    @property
    def main_exit(self) -> dict | None:
        return self._stage(self.main_exit_event)

    # Derived progress label from which checkpoints have fired (UI status chip):
    # karyerda → yolda → zavodda → yakunlandi; chala = chain broke (incomplete,
    # huquqbuzarlik); yuk_emas = completed but netto below the cargo floor.
    @property
    def stage(self) -> str:
        if self.status == "incomplete":
            return "chala"
        if self.status == "no_cargo":
            return "yuk_emas"
        if self.status == "done":
            return "yakunlandi"
        if self.main_enter_event_id is not None:
            return "zavodda"
        if self.kon_exit_event_id is not None:
            return "yolda"
        return "karyerda"
