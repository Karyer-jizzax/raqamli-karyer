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


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quarry_id: UUID
    plate_region: str
    plate_number: str
    kind: str  # karyer | tashqi
    status: str  # open | done | incomplete
    # derived progress: karyerda | yolda | zavodda | yakunlandi | chala
    stage: str
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
