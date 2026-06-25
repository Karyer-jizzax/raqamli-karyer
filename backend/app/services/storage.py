"""Local media storage. Swap for S3/MinIO in production (same interface)."""

import uuid
from pathlib import Path

MEDIA_DIR = Path(__file__).resolve().parent.parent.parent / "media"
MEDIA_URL_PREFIX = "/media"


def save_bytes(data: bytes, suffix: str = ".jpg") -> tuple[str, str]:
    """Persist bytes to the media dir. Returns (disk_path, served_url)."""
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{suffix}"
    path = MEDIA_DIR / name
    path.write_bytes(data)
    return str(path), f"{MEDIA_URL_PREFIX}/{name}"
