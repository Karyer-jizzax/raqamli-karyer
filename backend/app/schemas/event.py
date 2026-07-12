"""Event + volume DTOs."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

Direction = Literal["exit", "enter"]
PayerType = Literal["legal", "indiv", "yatt"]
StatusKey = Literal["confirm", "flagged", "inspect"]


class VolumeInputDto(BaseModel):
    material_id: str
    density: float
    weight_kg: float


class VolumeResultDto(BaseModel):
    volume_final: float
    confidence: float
    status: StatusKey


class EventCreate(BaseModel):
    # vehicle
    plate_region: str
    plate_number: str
    model: str = ""
    direction: Direction = "exit"
    is_loaded: bool = True
    vtype: str = "truck"
    payer_type: PayerType = "legal"
    # measurement — weight comes from the weighbridge (tarozi), not the camera
    material_id: str
    density: float
    weight_kg: int
    length_m: float = 0
    width_m: float = 0
    height_m: float = 0
    tent_cover_pct: float = 0
    material_confidence: float = 99.9
    # owner
    owner_name: str = ""
    stir: str = ""
    # scope / refs (superadmin may target a quarry; operator uses own)
    quarry_id: UUID | None = None
    post_id: UUID | None = None
    camera_id: UUID | None = None
    occurred_at: datetime | None = None


class EventPlateUpdate(BaseModel):
    """Manual plate fix for a "no_plate" event (ANPR couldn't read it)."""

    plate_region: str
    plate_number: str


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quarry_id: UUID
    plate_region: str
    plate_number: str
    model: str
    direction: str
    is_main: bool
    occurred_at: datetime
    is_loaded: bool
    vtype: str
    payer_type: str
    material_id: str | None
    density: float
    weight_kg: int
    length_m: float
    width_m: float
    height_m: float
    volume_camera: float | None
    volume_scale: float
    volume_final: float
    diff_pct: float | None
    volume_confidence: float
    material_confidence: float
    status: str
    owner_name: str
    stir: str
    # Captured media (populated from the Event.media relationship).
    image_urls: list[str] = []
    video_url: str | None = None
