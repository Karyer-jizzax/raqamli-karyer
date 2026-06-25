"""Protocol helpers — document number, verification code, real QR SVG."""

import io
import uuid
from datetime import datetime

import qrcode
from qrcode.image.svg import SvgPathImage

QR_SCHEME = "karier-kontrol://verify/"


def make_number(seq: int, dt: datetime) -> str:
    """Official document number, e.g. KK-10022026-00001."""
    return f"KK-{dt.strftime('%d%m%Y')}-{seq:05d}"


def make_verification_code(event_id: uuid.UUID) -> str:
    return event_id.hex[:10].upper()


def qr_payload(verification_code: str) -> str:
    return f"{QR_SCHEME}{verification_code}"


def qr_svg(payload: str) -> str:
    """Return a real, scannable QR code as an inline SVG string."""
    img = qrcode.make(payload, image_factory=SvgPathImage, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode("utf-8")
    # Strip the XML declaration so it can be embedded inline.
    if svg.startswith("<?xml"):
        svg = svg[svg.index("?>") + 2 :].lstrip()
    return svg
