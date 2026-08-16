"""Yuk xati (waybill) — the cargo receipt for one trip.

The document has no table of its own: the number, the verification code and
every field are derived from the trip. That keeps the receipt stable (opening
the same trip twice prints the same slip) without a migration, a sequence, or
a write on a GET.
"""

import io
from datetime import UTC, datetime
from urllib.parse import urlparse

import qrcode
from qrcode.image.svg import SvgPathImage
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.organization import Organization
from app.models.quarry import Quarry
from app.models.region import District, Region
from app.models.trip import Trip
from app.schemas.waybill import WaybillDocument, WaybillWeighing

# Path of the parolsiz page on the web apps; the QR points at it.
PUBLIC_PATH = "/yuk-xati"

# A dev machine is not in the CORS list but still needs a working QR.
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def make_number(trip: Trip) -> str:
    """Document number, e.g. YX-16082026-3F9C21."""
    return f"YX-{trip.started_at.strftime('%d%m%Y')}-{trip.id.hex[:6].upper()}"


def make_verification_code(trip: Trip) -> str:
    return trip.id.hex[:10].upper()


def qr_svg(payload: str) -> str:
    """A real, scannable QR code as an inline SVG string."""
    img = qrcode.make(payload, image_factory=SvgPathImage, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode("utf-8")
    # Strip the XML declaration so it can be embedded inline.
    if svg.startswith("<?xml"):
        svg = svg[svg.index("?>") + 2 :].lstrip()
    return svg


def _origin(url: str) -> str:
    parsed = urlparse(url.strip().rstrip("/"))
    return f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""


def public_origin(requested: str | None, fallback: str) -> str:
    """Where the QR should send the scanner.

    The two web apps live on different domains, so the app printing the receipt
    is the only one that knows its own origin — it sends it along. A client can
    say anything, though, so an origin is only honoured when it is already
    trusted through CORS (or is a dev machine); otherwise the configured
    `public_web_base` wins, and failing that the API's own address.
    """
    if requested:
        origin = _origin(requested)
        host = urlparse(origin).hostname or ""
        if origin and (origin in settings.cors_origin_list or host in _LOCAL_HOSTS):
            return origin
    return _origin(settings.public_web_base) or _origin(fallback)


async def build_waybill(db: AsyncSession, trip: Trip, base_url: str) -> WaybillDocument:
    quarry = await db.get(Quarry, trip.quarry_id)
    district = await db.get(District, quarry.district_id) if quarry else None
    region = await db.get(Region, district.region_id) if district else None
    org = (
        await db.get(Organization, quarry.organization_id)
        if quarry and quarry.organization_id
        else None
    )

    public_url = f"{base_url}{PUBLIC_PATH}/{trip.id}"
    return WaybillDocument(
        number=make_number(trip),
        verification_code=make_verification_code(trip),
        issued_at=datetime.now(UTC),
        public_url=public_url,
        qr_svg=qr_svg(public_url),
        trip_id=trip.id,
        organization_name=org.name if org else (quarry.name if quarry else ""),
        quarry_name=quarry.name if quarry else "",
        district_name_uz_latn=district.name_uz_latn if district else "",
        region_name_uz_latn=region.name_uz_latn if region else "",
        plate_region=trip.plate_region,
        plate_number=trip.plate_number,
        kind=trip.kind,
        status=trip.status,
        stage=trip.stage,
        enter=WaybillWeighing(at=trip.main_enter_at, weight_kg=trip.enter_weight_kg),
        exit=WaybillWeighing(at=trip.main_exit_at, weight_kg=trip.exit_weight_kg),
        netto_kg=trip.netto_kg,
        volume_m3=trip.volume_m3,
    )
