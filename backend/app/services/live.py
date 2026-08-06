"""Jonli ko'rish — snapshot keshi va MediaMTX havolalari (doc.txt §3.4, §5).

Ikkita rejim bor va ikkalasi ham shu yerdan boshqariladi:

* **snapshot** — juda sekin kanal (144 kbps): agent har 2-3 soniyada bitta
  JPEG yuboradi, biz uni **faqat xotirada** saqlaymiz va sayt so'raganda
  qaytaramiz. Diskka yozilmaydi — bu dalil emas, oynadan qarash; hodisa
  fotosi esa (dalil) odatdagidek media store'ga tushadi.
* **MediaMTX** — normal kanal: agent RTSP push qiladi, sayt HLS/WebRTC o'qiydi.
  Bu yerda faqat havolalar yasaladi, oqimning o'zi MediaMTX'dan o'tadi.

Kesh jarayon xotirasida: bir nechta ishchi jarayon bo'lsa har birida o'ziniki
turadi (eng yomon holat — kadr 2-3 soniya eskiroq ko'rinadi). Redis kerak
bo'lsa shu modul almashtiriladi, chaqiruvchilar o'zgarmaydi.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.config import settings

# Bitta kamera uchun bitta kadr: (quarry_id, camera_id) → oxirgi JPEG.
_SNAPSHOTS: dict[tuple[str, str], "Snapshot"] = {}

# Xotira tomchilamasin: kamera/karyer soni cheklangan, lekin agent xato
# camera_id yuboraversa lug'at o'sib ketmasligi kerak.
_MAX_ENTRIES = 512


@dataclass(frozen=True)
class Snapshot:
    data: bytes
    content_type: str
    captured_at: datetime

    @property
    def age_seconds(self) -> float:
        return (datetime.now(UTC) - self.captured_at).total_seconds()

    @property
    def is_fresh(self) -> bool:
        return self.age_seconds <= settings.live_snapshot_ttl_sec


def put_snapshot(
    quarry_id: str, camera_id: str, data: bytes, content_type: str = "image/jpeg"
) -> Snapshot:
    if len(_SNAPSHOTS) >= _MAX_ENTRIES and (quarry_id, camera_id) not in _SNAPSHOTS:
        # Eng eski kadrni chiqarib yuboramiz — yangi kamera joy topsin.
        oldest = min(_SNAPSHOTS, key=lambda k: _SNAPSHOTS[k].captured_at)
        _SNAPSHOTS.pop(oldest, None)
    snap = Snapshot(data=data, content_type=content_type, captured_at=datetime.now(UTC))
    _SNAPSHOTS[(quarry_id, camera_id)] = snap
    return snap


def get_snapshot(quarry_id: str, camera_id: str) -> Snapshot | None:
    return _SNAPSHOTS.get((quarry_id, camera_id))


def clear_snapshots() -> None:
    """Testlar uchun — jarayon xotirasi testlar orasida oqib ketmasin."""
    _SNAPSHOTS.clear()


# ── MediaMTX havolalari (doc.txt §5) ──────────────────────────────────────


def _slug(value: str) -> str:
    """Yo'l bo'lagida faqat harf/raqam/pastki chiziq qoladi — karyer kodidagi
    tire yoki bo'sh joy RTSP URL'ni buzmasin."""
    return "".join(c if c.isalnum() else "_" for c in value).lower()


def stream_path(quarry_code: str, camera_id: str) -> str:
    """MediaMTX yo'li: `karyer_<kod>_<kamera>` (mediamtx.yml dagi `~^karyer_`)."""
    return f"karyer_{_slug(quarry_code)}_{_slug(camera_id)}"


# Agent yo'lni o'zi to'ldiradi: bir nechta kamera bo'lsa har biriga alohida
# yo'l kerak, biz esa uning kamera nomlarini oldindan bilmaymiz.
CAMERA_PLACEHOLDER = "{camera_id}"


def stream_path_template(quarry_code: str) -> str:
    """`karyer_<kod>_{camera_id}` — agent `{camera_id}`ni o'zi almashtiradi.

    Alohida funksiya, chunki `stream_path`ga shablonni berib bo'lmaydi:
    u kamera nomini tozalaydi va `{camera_id}` `_camera_id_`ga aylanib,
    shablon ishlamay qolardi."""
    return f"karyer_{_slug(quarry_code)}_{CAMERA_PLACEHOLDER}"


def _rtsp_base() -> str | None:
    """RTSP manzili login-parol bilan; MediaMTX sozlanmagan bo'lsa None.

    None bo'lsa agent jonli oqimni o'chirib qo'yadi — asosiy ish (hodisa
    yuborish) unga bog'liq emas (doc.txt §4.3)."""
    base = settings.mediamtx_rtsp_url.rstrip("/")
    if not base:
        return None
    if settings.mediamtx_publish_user and "@" not in base.split("//", 1)[-1]:
        scheme, _, host = base.partition("//")
        creds = f"{settings.mediamtx_publish_user}:{settings.mediamtx_publish_pass}"
        base = f"{scheme}//{creds}@{host}"
    return base


def publish_url(quarry_code: str, camera_id: str) -> str | None:
    """Agent RTSP push qiladigan manzil (bitta kamera uchun)."""
    base = _rtsp_base()
    return None if base is None else f"{base}/{stream_path(quarry_code, camera_id)}"


def publish_url_template(quarry_code: str) -> str | None:
    """Bir nechta kamerali agent uchun: `…/karyer_<kod>_{camera_id}`."""
    base = _rtsp_base()
    return None if base is None else f"{base}/{stream_path_template(quarry_code)}"


def hls_url(quarry_code: str, camera_id: str) -> str | None:
    """Sayt pleeri o'qiydigan HLS manzili."""
    base = settings.mediamtx_hls_url.rstrip("/")
    if not base:
        return None
    return f"{base}/{stream_path(quarry_code, camera_id)}/index.m3u8"


def webrtc_url(quarry_code: str, camera_id: str) -> str | None:
    """Past kechikish kerak bo'lganda — WebRTC (WHEP) manzili.

    Brauzer shu manzilga SDP offer POST qiladi; kutubxona kerak emas."""
    base = settings.mediamtx_webrtc_url.rstrip("/")
    if not base:
        return None
    return f"{base}/{stream_path(quarry_code, camera_id)}/whep"
