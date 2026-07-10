"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.local import router as local_router
from app.api.v1.router import api_router
from app.api.weigh import router as weigh_router
from app.core.config import settings
from app.services.storage import MEDIA_DIR

app = FastAPI(
    title="Karier Kontrol API",
    version="0.0.0",
    description="Karyerlar nazorati avtomatlashtirilgan tizimi",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)

# Quarry local-server ingest — matches API.md exactly (/api/ping, /api/weigh),
# authenticated by X-API-Key rather than JWT.
app.include_router(weigh_router, prefix="/api")

# Local-server provisioning (GET /api/local/config) — provision-JWT auth.
app.include_router(local_router, prefix="/api")

# Serve uploaded media (camera frames). Swap for S3/CDN in production.
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
