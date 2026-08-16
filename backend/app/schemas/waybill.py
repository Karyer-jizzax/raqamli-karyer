"""Yuk xati (waybill) DTOs — the cargo receipt for one trip.

Deliberately narrow: the document is a kassa-cheki style slip showing when the
truck was weighed in, when it was weighed out, and how much cargo that leaves.
Vehicle model, owner, STIR and material are not on it, so they are not here.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WaybillWeighing(BaseModel):
    """One weighbridge crossing: when it happened and what the scale read."""

    at: datetime | None = None
    weight_kg: int | None = None


class WaybillDocument(BaseModel):
    """Everything the receipt prints, and nothing else.

    Derived from the trip on read — there is no waybills table, so `number`
    and `verification_code` stay the same every time the same trip is opened.
    """

    # document identity
    number: str
    verification_code: str
    issued_at: datetime
    # where the QR points: the parolsiz (public) page for this trip
    public_url: str
    qr_svg: str

    # who weighed it
    trip_id: UUID
    organization_name: str
    quarry_name: str
    district_name_uz_latn: str
    region_name_uz_latn: str

    # which vehicle, and how the run ended
    plate_region: str
    plate_number: str
    kind: str  # karyer | tashqi
    status: str  # open | done | incomplete | no_cargo
    stage: str  # karyerda | yolda | zavodda | yakunlandi | chala | yuk_emas

    # the two scale readings and what they add up to
    enter: WaybillWeighing
    exit: WaybillWeighing
    netto_kg: int | None = None
    volume_m3: float | None = None
