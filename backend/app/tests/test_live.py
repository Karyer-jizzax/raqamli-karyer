"""Jonli oqim havolalari (`services/live.py`). DB kerak emas.

MediaMTX yo'llari sof matn hisobi, lekin xato bo'lsa oqim umuman ochilmaydi
va sababi faqat serverda ko'rinadi — shuning uchun alohida test.
"""

import pytest

from app.core.config import settings
from app.services.live import (
    hls_url,
    publish_url,
    publish_url_template,
    stream_path,
    stream_path_template,
    webrtc_url,
)


@pytest.fixture
def mediamtx(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "mediamtx_rtsp_url", "rtsp://api.example.uz:8554")
    monkeypatch.setattr(settings, "mediamtx_publish_user", "agent")
    monkeypatch.setattr(settings, "mediamtx_publish_pass", "s3cret")
    monkeypatch.setattr(settings, "mediamtx_hls_url", "https://api.example.uz/live/hls")
    monkeypatch.setattr(settings, "mediamtx_webrtc_url", "https://api.example.uz/live/webrtc")


def test_stream_path_sanitizes_each_part() -> None:
    # Karyer kodidagi tire va bo'sh joy RTSP URL'ni buzmasligi kerak.
    assert stream_path("DEMO-1", "P-TAROZI C1") == "karyer_demo_1_P_TAROZI_C1"


def test_camera_case_survives_the_round_trip() -> None:
    """Agent shablonga kamera nomini AYNAN qo'yadi (masalan `DAHUASBJN`).

    Kamera bo'lagini kichik harfga tushirsak, agent `…_DAHUASBJN`ga push
    qilib, pleer `…_dahuasbjn`ni so'rardi — muzokaralar o'tadi, ekran qora
    qoladi. Shuning uchun ikkala tomon bir xil satr chiqarishi shart."""
    template = stream_path_template("TIANGSHANG78ZD-Q52138")
    assert template.format(camera_id="DAHUASBJN") == stream_path(
        "TIANGSHANG78ZD-Q52138", "DAHUASBJN"
    )


def test_path_template_keeps_placeholder() -> None:
    """`{camera_id}` tozalanmaydi — aks holda `_camera_id_` bo'lib qolib,
    agent bir nechta kamera uchun yo'l yasay olmaydi."""
    assert stream_path_template("DEMO-1") == "karyer_demo_1_{camera_id}"
    # Shablon haqiqiy yo'lga aylanganda `stream_path` bilan bir xil chiqsin.
    assert stream_path_template("DEMO-1").format(camera_id="cam1") == stream_path("DEMO-1", "cam1")


def test_urls_carry_credentials_and_paths(mediamtx: None) -> None:
    assert publish_url("DEMO-1", "cam1") == "rtsp://agent:s3cret@api.example.uz:8554/karyer_demo_1_cam1"
    assert publish_url_template("DEMO-1") == (
        "rtsp://agent:s3cret@api.example.uz:8554/karyer_demo_1_{camera_id}"
    )
    assert hls_url("DEMO-1", "cam1") == (
        "https://api.example.uz/live/hls/karyer_demo_1_cam1/index.m3u8"
    )
    # WHEP: brauzer SDP offer'ni shu manzilga POST qiladi.
    assert webrtc_url("DEMO-1", "cam1") == (
        "https://api.example.uz/live/webrtc/karyer_demo_1_cam1/whep"
    )


def test_urls_are_none_when_mediamtx_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sozlanmagan server — jonli oqim e'lon qilinmaydi, agent snapshot
    rejimida ishlayveradi (doc.txt §4.3)."""
    for field in ("mediamtx_rtsp_url", "mediamtx_hls_url", "mediamtx_webrtc_url"):
        monkeypatch.setattr(settings, field, "")
    assert publish_url("DEMO-1", "cam1") is None
    assert publish_url_template("DEMO-1") is None
    assert hls_url("DEMO-1", "cam1") is None
    assert webrtc_url("DEMO-1", "cam1") is None
