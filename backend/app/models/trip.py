"""Trip (qatnov) — one vehicle's linked journey through the checkpoints.

A trip is a header row plus an ordered list of `TripStop`s, one per checkpoint
event. The chain itself is **not** fixed: `services.flow` reads the quarry's
configured post roles and says which steps to expect, so

  karyer → zavod            (kon enter/exit → tarozi enter/exit)
  karyer → drabilka         (kon enter/exit → drabilka enter/exit, no scale)
  karyer → drabilka → zavod (all three nodes)

are all the same code path. This used to be four hardcoded FK columns and a
2×2 dispatch on `(is_main, direction)`, which could not express a third node
and assumed every trip ends on a weighbridge.

Netto is only meaningful where a scale exists:

* `netto_source="scale"` — the weighed node produced both readings.
  Vehicle type 1 (karyer tashuvchisi): loaded in, empty out → enter − exit.
  Vehicle type 2 (tashqi mashina): empty in, loaded out → exit − enter.
* `netto_source="count"` — no scale on the chain (drabilka). The trip is
  counted, `netto_kg` stays NULL and reports must not read it as zero.

Rows are created/updated incrementally by `services.trips.link_event` as
events arrive from the local server — never by the client directly.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.event import Event

# Zanjir tugunlari (post rollari shu tugunlarga xaritalanadi — services.flow).
NODE_KON = "kon"
NODE_DRABILKA = "drabilka"
NODE_TAROZI = "tarozi"
# Vazn o'lchanadigan yagona tugun — netto shundan hisoblanadi.
WEIGHED_NODE = NODE_TAROZI

# Qatnov qaysi tugunda turibdi (yakunlanmagan qatnovning UI holati).
_STAGE_AT = {NODE_KON: "karyerda", NODE_DRABILKA: "drabilkada", NODE_TAROZI: "zavodda"}


class TripStop(Base, UUIDMixin, TimestampMixin):
    """One checkpoint crossing inside a trip."""

    __tablename__ = "trip_stops"
    __table_args__ = (UniqueConstraint("trip_id", "node", "direction", name="uq_trip_stops_step"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), index=True
    )
    # Karyerning zanjiridagi o'rni — bosqichlar tartibi shu bo'yicha.
    seq: Mapped[int] = mapped_column(Integer)
    node: Mapped[str] = mapped_column(String(16))  # kon | drabilka | tarozi
    direction: Mapped[str] = mapped_column(String(8))  # enter | exit
    post_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("posts.id"), nullable=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"), index=True)
    # Tarozili tugunda o'lchangan vazn; boshqa joyda None.
    weight_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # selectin — chain-loads with the trips query, no lazy IO under async.
    event: Mapped[Event | None] = relationship(
        "Event", foreign_keys=[event_id], lazy="selectin", viewonly=True
    )


class Trip(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "trips"

    quarry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quarries.id"), index=True)

    # vehicle snapshot (matched by plate across checkpoints)
    plate_region: Mapped[str] = mapped_column(String(8))
    plate_number: Mapped[str] = mapped_column(String(16), index=True)

    # karyer = kon chiqishidan boshlangan (material olib keladi);
    # tashqi = zavodga to'g'ridan-to'g'ri kelgan (mahsulot olib ketadi)
    kind: Mapped[str] = mapped_column(String(16), default="karyer")
    # open = davom etmoqda; done = yakunlangan (oxirgi bosqich bilan);
    # incomplete = keyingi hodisa kelmay eskirgan/almashtirilgan (chala);
    # no_cargo = yakunlangan, lekin netto < trip_min_netto_kg (yuk emas)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    # scale = netto tarozida o'lchandi; count = zanjirda tarozi yo'q, qatnov
    # sanaldi (netto_kg NULL bo'lib qoladi va nol deb o'qilmasligi kerak).
    netto_source: Mapped[str | None] = mapped_column(String(8), nullable=True)

    # weighbridge readings (kg); None until the event arrives or if unweighed
    enter_weight_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exit_weight_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # material amount (kg), always >= 0: karyer = enter−exit, tashqi = exit−enter
    netto_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    stops: Mapped[list[TripStop]] = relationship(
        "TripStop",
        order_by="TripStop.seq",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    # ── stop lookups ───────────────────────────────────────────────────────
    def stop(self, node: str, direction: str) -> TripStop | None:
        return next(
            (s for s in self.stops if s.node == node and s.direction == direction), None
        )

    @property
    def last_stop(self) -> TripStop | None:
        return max(self.stops, key=lambda s: s.seq) if self.stops else None

    def _stop_event_id(self, node: str, direction: str) -> uuid.UUID | None:
        s = self.stop(node, direction)
        return s.event_id if s else None

    # Legacy accessors — the four columns this model used to carry. Kept as
    # derived values so TripOut (and the deployed frontend) keep working while
    # the chain itself is generic; a drabilka trip simply has none of them.
    @property
    def kon_enter_event_id(self) -> uuid.UUID | None:
        return self._stop_event_id(NODE_KON, "enter")

    @property
    def kon_exit_event_id(self) -> uuid.UUID | None:
        return self._stop_event_id(NODE_KON, "exit")

    @property
    def main_enter_event_id(self) -> uuid.UUID | None:
        return self._stop_event_id(NODE_TAROZI, "enter")

    @property
    def main_exit_event_id(self) -> uuid.UUID | None:
        return self._stop_event_id(NODE_TAROZI, "exit")

    def _stop_at(self, node: str, direction: str) -> datetime | None:
        s = self.stop(node, direction)
        return s.occurred_at if s else None

    @property
    def kon_enter_at(self) -> datetime | None:
        return self._stop_at(NODE_KON, "enter")

    @property
    def kon_exit_at(self) -> datetime | None:
        return self._stop_at(NODE_KON, "exit")

    @property
    def main_enter_at(self) -> datetime | None:
        return self._stop_at(NODE_TAROZI, "enter")

    @property
    def main_exit_at(self) -> datetime | None:
        return self._stop_at(NODE_TAROZI, "exit")

    # Per-stage media (linked event's ANPR snapshots + clip) for the UI modal.
    # TripStop.event is selectin too, so it chain-loads with the trips query.
    @staticmethod
    def _stage_media(stop: TripStop | None) -> dict | None:
        if stop is None or stop.event is None:
            return None
        return {
            "event_id": stop.event_id,
            "occurred_at": stop.occurred_at,
            "image_urls": stop.event.image_urls,
            "video_url": stop.event.video_url,
        }

    @property
    def stages(self) -> list[dict]:
        """Every stop as `{node, direction, ...media}` — the generic view the
        trips table renders columns from (the flow decides how many there are)."""
        out: list[dict] = []
        for s in sorted(self.stops, key=lambda x: x.seq):
            media = self._stage_media(s) or {
                "event_id": s.event_id,
                "occurred_at": s.occurred_at,
                "image_urls": [],
                "video_url": None,
            }
            out.append(
                {
                    "node": s.node,
                    "direction": s.direction,
                    "seq": s.seq,
                    "weight_kg": s.weight_kg,
                    **media,
                }
            )
        return out

    @property
    def kon_enter(self) -> dict | None:
        return self._stage_media(self.stop(NODE_KON, "enter"))

    @property
    def kon_exit(self) -> dict | None:
        return self._stage_media(self.stop(NODE_KON, "exit"))

    @property
    def main_enter(self) -> dict | None:
        return self._stage_media(self.stop(NODE_TAROZI, "enter"))

    @property
    def main_exit(self) -> dict | None:
        return self._stage_media(self.stop(NODE_TAROZI, "exit"))

    # Netto (t) ÷ cargo density (t/m³). The cargo is weighed loaded — karyer
    # trips at the scale enter (brutto), tashqi trips at the scale exit — so
    # take the density from that event; fall back to any linked event with one.
    @property
    def volume_m3(self) -> float | None:
        if self.netto_kg is None:
            return None
        loaded = "enter" if self.kind == "karyer" else "exit"
        ordered = [self.stop(WEIGHED_NODE, loaded), *sorted(self.stops, key=lambda s: -s.seq)]
        for stop in ordered:
            ev = stop.event if stop is not None else None
            rho = float(ev.density) if ev is not None and ev.density is not None else 0.0
            if rho > 0:
                return round(self.netto_kg / 1000 / rho, 2)
        return None

    # Derived progress label from how far along the chain the trip got:
    # karyerda → yolda → drabilkada/zavodda → yakunlandi; chala = chain broke
    # (incomplete), yuk_emas = completed but netto below the cargo floor.
    @property
    def stage(self) -> str:
        if self.status == "incomplete":
            return "chala"
        if self.status == "no_cargo":
            return "yuk_emas"
        if self.status == "done":
            return "yakunlandi"
        last = self.last_stop
        if last is None:
            return "karyerda"
        # Nuqtadan chiqib ketgan, keyingisiga yetmagan — yo'lda.
        if last.direction == "exit":
            return "yolda"
        return _STAGE_AT.get(last.node, "yolda")
