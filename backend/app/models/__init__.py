"""ORM models. Import all here so Alembic autogenerate sees the full metadata."""

from app.models.event import Event
from app.models.material import Material
from app.models.media import Media
from app.models.organization import Organization
from app.models.protocol import Protocol
from app.models.quarry import Camera, Post, Quarry
from app.models.region import District, Region
from app.models.user import User
from app.models.vehicle import Vehicle

__all__ = [
    "Event",
    "Material",
    "Media",
    "Organization",
    "Protocol",
    "Quarry",
    "Post",
    "Camera",
    "District",
    "Region",
    "User",
    "Vehicle",
]
