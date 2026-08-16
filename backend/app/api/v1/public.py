"""Parolsiz (unauthenticated) endpoints — what a scanned QR code resolves to.

Everything else under /api/v1 sits behind `get_current_user`; these routes
deliberately do not. The only key is the trip's own id — a random UUID4 that
is never listed anywhere public — and the payload is read-only cargo data:
no media, no operator names, no ids that would let a scanner walk the tenant.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.trip import Trip
from app.schemas.waybill import WaybillDocument
from app.services.waybill import build_waybill, public_origin

router = APIRouter(tags=["public"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/public/waybill/{trip_id}", response_model=WaybillDocument)
async def public_waybill(
    trip_id: UUID,
    db: DbDep,
    request: Request,
    public_base: Annotated[str | None, Query()] = None,
) -> WaybillDocument:
    """Yuk xati, parolsiz — the page a QR scan lands on."""
    trip = await db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Yuk xati topilmadi")
    return await build_waybill(db, trip, public_origin(public_base, str(request.base_url)))
