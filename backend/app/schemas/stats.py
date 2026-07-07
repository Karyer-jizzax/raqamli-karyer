"""Stats / geo DTOs for the department app."""

from uuid import UUID

from pydantic import BaseModel


class Overview(BaseModel):
    quarries: int
    districts: int
    cameras: int
    cameras_active: int
    cameras_inactive: int
    organizations: int
    events: int
    total_volume: float
    avg_confidence: float


class QuarryStats(BaseModel):
    """Per-quarry dashboard numbers (QuarryDetail page)."""

    events: int
    trucks: int
    volume: float
    loaded: int
    not_loaded: int
    unidentified: int
    cameras: int
    cameras_active: int
    cameras_inactive: int
    last_event_at: str | None


class CargoPost(BaseModel):
    id: UUID
    code: str
    name: str
    events: int
    trucks: int
    cameras: int
    cameras_active: int


class CargoQuarryRow(BaseModel):
    id: UUID
    name: str
    count: int
    volume: float


class DistrictCargo(BaseModel):
    """District cargo dashboard: totals + per-post strip + per-quarry table."""

    trucks_total: int
    loaded: int
    not_loaded: int
    unidentified: int
    posts: list[CargoPost]
    quarries: list[CargoQuarryRow]
    last_event_at: str | None


class DistrictGeo(BaseModel):
    id: UUID
    name_uz_latn: str
    name_uz_cyrl: str
    name_ru: str
    is_capital: bool
    svg_path: str | None
    center_x: float | None
    center_y: float | None
    quarry_count: int
    event_count: int


class RegionGeo(BaseModel):
    region_id: UUID
    view_height: float
    districts: list[DistrictGeo]


class M1Row(BaseModel):
    id: UUID
    post_code: str | None
    camera_label: str | None
    plate_region: str
    plate_number: str
    model: str
    vtype: str
    direction: str
    is_main: bool
    occurred_at: str
    is_loaded: bool
    material_id: str | None
    weight_kg: int
    density: float
    volume_final: float
    volume_confidence: float
    material_confidence: float
    payer_type: str
    stir: str
    owner_name: str
    status: str
    image_urls: list[str] = []
    video_url: str | None = None


class M1Response(BaseModel):
    rows: list[M1Row]
    total_count: int
    total_volume: float


class DynamicsBucket(BaseModel):
    month: int
    total: int
    confirmed: int
    detection_pct: float


class DynamicsResponse(BaseModel):
    year: int
    buckets: list[DynamicsBucket]
    total_events: int
    avg_detection: float


class ReportRow(BaseModel):
    key: str
    count: int
    volume: float


class ReportResponse(BaseModel):
    report: str  # M2 | M3 | M4 | M5
    dimension: str
    rows: list[ReportRow]
