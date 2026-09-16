"""Trip (qatnov) DTOs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TripStageOut(BaseModel):
    """One linked checkpoint event's timestamp + captured media."""

    event_id: UUID
    occurred_at: datetime
    image_urls: list[str] = []
    video_url: str | None = None


class TripStopOut(TripStageOut):
    """A stop with its place in the chain — the generic shape the trips table
    builds its columns from, so a drabilka stage needs no new field."""

    node: str  # kon | drabilka | tarozi
    direction: str  # enter | exit
    seq: int
    # Faqat tarozili tugunda o'lchanadi; drabilkada doim None.
    weight_kg: int | None = None


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quarry_id: UUID
    plate_region: str
    plate_number: str
    kind: str  # karyer | tashqi
    status: str  # open | done | incomplete | no_cargo
    # scale = netto tarozida o'lchandi; count = zanjirda tarozi yo'q, qatnov
    # sanaldi (netto_kg NULL — nol deb o'qilmasin).
    netto_source: str | None = None
    # derived: karyerda | yolda | drabilkada | zavodda | yakunlandi | chala
    stage: str
    # Zanjirdagi barcha to'xtashlar, tartib bilan. Quyidagi kon_*/main_*
    # maydonlari shundan hisoblanadi va faqat eski mijozlar uchun qoladi.
    stages: list[TripStopOut] = []
    kon_enter_event_id: UUID | None
    kon_exit_event_id: UUID | None
    main_enter_event_id: UUID | None
    main_exit_event_id: UUID | None
    enter_weight_kg: int | None
    exit_weight_kg: int | None
    netto_kg: int | None
    # netto (t) ÷ density (t/m³) from the loaded-side weigh event
    volume_m3: float | None = None
    started_at: datetime
    completed_at: datetime | None
    # per-stage timestamps (from the linked events) for the UI table
    kon_enter_at: datetime | None = None
    kon_exit_at: datetime | None = None
    main_enter_at: datetime | None = None
    main_exit_at: datetime | None = None
    # per-stage media (photos/video of the linked events) for the UI modal
    kon_enter: TripStageOut | None = None
    kon_exit: TripStageOut | None = None
    main_enter: TripStageOut | None = None
    main_exit: TripStageOut | None = None
