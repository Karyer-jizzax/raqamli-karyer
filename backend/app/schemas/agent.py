"""Tarozi punkti agenti DTO'lari — doc.txt §3 sxemalari."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

VideoQuality = Literal["auto", "snapshot", "low", "medium", "high"]


class AgentEventIn(BaseModel):
    """`POST /api/agent/events` dagi `event` JSON qismi (doc §3.1)."""

    event_id: str
    occurred_at: datetime
    weight_kg: float
    weight_stable: bool = True
    scale: str = ""
    camera_id: str | None = None
    # ANPR yo'q — operator saytda videoni ko'rib qo'lda kiritadi (doc §3.1).
    vehicle_number: str | None = None
    agent_version: str = ""
    # Ixtiyoriy: karyerda bir nechta mahsulot bo'lsa agent qaysi biri ekanini
    # bilsa yuboradi; bilmasa backend karyer ro'yxatidan hal qiladi.
    material_id: str | None = None


class AgentCameraState(BaseModel):
    id: str
    ok: bool = True


class AgentHeartbeatIn(BaseModel):
    """`POST /api/agent/heartbeat` (doc §3.3)."""

    agent_version: str = ""
    scale_ok: bool = False
    cameras: list[AgentCameraState] = []
    queue_size: int = 0
    upload_kbps_avg: int = 0
    live_streaming: bool = False
    current_quality: str = ""


class AgentConfigUpdate(BaseModel):
    """Adminkadagi sozlash formasi (doc §3.2 maydonlari, hammasi ixtiyoriy)."""

    video_quality: VideoQuality | None = None
    quality_profiles_override: dict | None = None
    live_stream_enabled: bool | None = None
    event_pre_seconds: int | None = Field(default=None, ge=0, le=60)
    event_post_seconds: int | None = Field(default=None, ge=0, le=60)
    min_event_weight_kg: int | None = Field(default=None, ge=0, le=100_000)
    stable_seconds: int | None = Field(default=None, ge=1, le=60)
    heartbeat_interval_sec: int | None = Field(default=None, ge=10, le=3600)


class AgentConfigOut(BaseModel):
    video_quality: str
    quality_profiles_override: dict | None
    live_stream_enabled: bool
    event_pre_seconds: int
    event_post_seconds: int
    min_event_weight_kg: int
    stable_seconds: int
    heartbeat_interval_sec: int


class LiveStreamOut(BaseModel):
    """Bitta kamera uchun jonli ko'rish havolalari."""

    # Texnik identifikator: MediaMTX yo'li va snapshot kaliti shundan yasaladi.
    camera_id: str
    # Adminkada berilgan nom — sahifada ko'rinadigani. Kamera bazadan
    # topilmasa `camera_id` bilan bir xil bo'ladi.
    camera_name: str = ""
    # Kamera qaysi postda — sahifa kameralarni shu bo'yicha guruhlaydi va
    # filtrlaydi. Bazada topilmagan kameraga bo'sh.
    post_name: str = ""
    hls_url: str | None = None
    webrtc_url: str | None = None
    # Snapshot rejimida sayt shu manzilni har 2-3 soniyada yangilaydi.
    snapshot_url: str


class AgentStatusOut(BaseModel):
    """Karyer sahifasidagi agent kartasi (doc §2.2, §3.3, §3.5)."""

    model_config = ConfigDict(from_attributes=True)

    quarry_id: str
    # Token faqat superadminga ko'rinadi — boshqa rollarda None.
    token: str | None = None
    token_issued_at: datetime | None = None
    revoked_at: datetime | None = None
    is_active: bool = False
    online: bool = False
    last_seen_at: datetime | None = None
    agent_version: str = ""
    scale_ok: bool = False
    cameras: list[AgentCameraState] = []
    queue_size: int = 0
    upload_kbps_avg: int = 0
    live_streaming: bool = False
    current_quality: str = ""
    config: AgentConfigOut | None = None
    # "hls" — MediaMTX oqimi bor; "snapshot" — JPEG kadr; "off" — jonli
    # ko'rinish yo'q (agent offline, o'chirilgan yoki kanal juda sekin).
    live_mode: Literal["hls", "snapshot", "off"] = "off"
    streams: list[LiveStreamOut] = []
