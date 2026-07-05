"""Video / AI detection DTOs."""

from uuid import UUID

from pydantic import BaseModel

from app.schemas.event import EventOut


class DetectionOut(BaseModel):
    plate_region: str
    plate_number: str
    model: str
    material_id: str
    bbox: list[float]  # [x, y, w, h] normalized 0..1
    plate_confidence: float
    type_confidence: float


class AnalyzeResponse(BaseModel):
    detection: DetectionOut
    media_id: UUID | None = None
    media_url: str | None = None


class IngestResponse(BaseModel):
    event: EventOut
    detection: DetectionOut
    media_url: str | None = None
