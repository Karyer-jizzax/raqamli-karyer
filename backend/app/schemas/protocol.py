"""Protocol DTOs — full document data for rendering an A4 measurement protocol."""

from uuid import UUID

from pydantic import BaseModel

from app.schemas.event import EventOut


class ProtocolMeta(BaseModel):
    id: UUID
    event_id: UUID
    number: str
    verification_code: str
    qr_payload: str
    inspector_name: str
    operator_name: str
    driver_name: str
    normative_basis: str
    issued_at: str


class ProtocolDocument(BaseModel):
    """Everything the frontend needs to render + print the protocol."""

    protocol: ProtocolMeta
    event: EventOut
    qr_svg: str
    quarry_name: str
    district_name_uz_latn: str
    region_name_uz_latn: str
    material_name_uz_latn: str | None
    organization: str = "Karier Kontrol"


class ProtocolSignatures(BaseModel):
    inspector_name: str | None = None
    operator_name: str | None = None
    driver_name: str | None = None
