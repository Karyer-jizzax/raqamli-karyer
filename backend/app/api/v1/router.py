"""Aggregates all v1 routers."""

from fastapi import APIRouter

from app.api.v1 import (
    agents,
    auth,
    events,
    materials,
    organizations,
    protocols,
    public,
    quarries,
    regions,
    scale,
    settings,
    stats,
    trips,
    users,
    video,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(materials.router)
api_router.include_router(regions.router)
api_router.include_router(organizations.router)
api_router.include_router(quarries.router)
api_router.include_router(agents.router)
api_router.include_router(events.router)
api_router.include_router(trips.router)
api_router.include_router(protocols.router)
api_router.include_router(video.router)
api_router.include_router(scale.router)
api_router.include_router(stats.router)
api_router.include_router(users.router)
api_router.include_router(settings.router)
# Parolsiz — QR kod shu yerga olib keladi. Auth dependency'siz (public.py).
api_router.include_router(public.router)
