"""Protocol generation + retrieval (O'lchov bayonnomasi)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.material import Material
from app.models.protocol import NORMATIVE_BASIS, Protocol
from app.models.quarry import Quarry
from app.models.region import District, Region
from app.schemas.event import EventOut
from app.schemas.protocol import ProtocolDocument, ProtocolMeta, ProtocolSignatures
from app.services.protocol import make_number, make_verification_code, qr_payload, qr_svg

router = APIRouter(tags=["protocols"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[object, Depends(get_current_user)]


async def _build_document(db: AsyncSession, protocol: Protocol, event: Event) -> ProtocolDocument:
    quarry = await db.get(Quarry, event.quarry_id)
    district = await db.get(District, quarry.district_id) if quarry else None
    region = await db.get(Region, district.region_id) if district else None
    material = await db.get(Material, event.material_id) if event.material_id else None

    return ProtocolDocument(
        protocol=ProtocolMeta(
            id=protocol.id,
            event_id=protocol.event_id,
            number=protocol.number,
            verification_code=protocol.verification_code,
            qr_payload=protocol.qr_payload,
            inspector_name=protocol.inspector_name,
            operator_name=protocol.operator_name,
            driver_name=protocol.driver_name,
            normative_basis=protocol.normative_basis,
            issued_at=protocol.issued_at.isoformat(),
        ),
        event=EventOut.model_validate(event),
        qr_svg=qr_svg(protocol.qr_payload),
        quarry_name=quarry.name if quarry else "",
        district_name_uz_latn=district.name_uz_latn if district else "",
        region_name_uz_latn=region.name_uz_latn if region else "",
        material_name_uz_latn=material.name_uz_latn if material else None,
    )


@router.post(
    "/events/{event_id}/protocol",
    response_model=ProtocolDocument,
    status_code=status.HTTP_201_CREATED,
)
async def create_protocol(
    event_id: UUID, db: DbDep, user: UserDep, body: ProtocolSignatures | None = None
) -> ProtocolDocument:
    event = await db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hodisa topilmadi")

    existing = (
        await db.execute(select(Protocol).where(Protocol.event_id == event_id))
    ).scalar_one_or_none()
    if existing is not None:
        return await _build_document(db, existing, event)

    seq = ((await db.execute(select(func.count()).select_from(Protocol))).scalar() or 0) + 1
    code = make_verification_code(event_id)
    sig = body or ProtocolSignatures()
    protocol = Protocol(
        event_id=event_id,
        number=make_number(seq, event.occurred_at or datetime.now()),
        verification_code=code,
        qr_payload=qr_payload(code),
        inspector_name=sig.inspector_name or "",
        operator_name=sig.operator_name or getattr(user, "full_name", ""),
        driver_name=sig.driver_name or "",
        normative_basis=NORMATIVE_BASIS,
    )
    db.add(protocol)
    await db.commit()
    await db.refresh(protocol)
    return await _build_document(db, protocol, event)


@router.get("/events/{event_id}/protocol", response_model=ProtocolDocument)
async def get_event_protocol(event_id: UUID, db: DbDep, _user: UserDep) -> ProtocolDocument:
    event = await db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hodisa topilmadi")
    protocol = (
        await db.execute(select(Protocol).where(Protocol.event_id == event_id))
    ).scalar_one_or_none()
    if protocol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bayonnoma yaratilmagan")
    return await _build_document(db, protocol, event)


@router.get("/protocols/{protocol_id}", response_model=ProtocolDocument)
async def get_protocol(protocol_id: UUID, db: DbDep, _user: UserDep) -> ProtocolDocument:
    protocol = await db.get(Protocol, protocol_id)
    if protocol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bayonnoma topilmadi")
    event = await db.get(Event, protocol.event_id)
    return await _build_document(db, protocol, event)
