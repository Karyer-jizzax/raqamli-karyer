"""Application settings loaded from environment (.env)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://karier:karier@localhost:5432/karier"

    # Auth / JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # CORS — comma-separated list of the 3 frontend origins
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175"

    api_v1_prefix: str = "/api/v1"

    # Quarry local-server ingest (API.md /api/weigh) — comma-separated list of
    # valid X-API-Key values (one per quarry local server). Change in prod.
    weigh_api_keys: str = "KARYER-01-SECRET"
    # Max size (MB) per uploaded part. The local server sends a ~10s H.264 clip
    # plus jpg snapshots; Starlette's default 1MB/part would reject them.
    weigh_max_upload_mb: int = 120

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def weigh_api_key_set(self) -> set[str]:
        return {k.strip() for k in self.weigh_api_keys.split(",") if k.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
