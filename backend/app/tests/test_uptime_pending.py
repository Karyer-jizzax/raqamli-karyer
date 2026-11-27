"""Oflayn agentning hali yuborilmagan uzilishi — kunlar bo'yicha daqiqalar."""

from datetime import UTC, date, datetime

from app.services.uptime import day_elapsed_min, pending_offline_minutes


def test_pending_offline_same_day() -> None:
    # 11:51 → 15:00 (UTC+5) = 189 daqiqa
    last_seen = datetime(2026, 11, 27, 6, 51, tzinfo=UTC)
    now = datetime(2026, 11, 27, 10, 0, tzinfo=UTC)
    assert pending_offline_minutes(last_seen, None, None, now) == {date(2026, 11, 27): 189}


def test_pending_offline_spans_midnight_and_respects_range() -> None:
    # 26-noyabr 23:00 → 27-noyabr 01:30 (UTC+5)
    last_seen = datetime(2026, 11, 26, 18, 0, tzinfo=UTC)
    now = datetime(2026, 11, 26, 20, 30, tzinfo=UTC)
    assert pending_offline_minutes(last_seen, None, None, now) == {
        date(2026, 11, 26): 60,
        date(2026, 11, 27): 90,
    }
    only_today = pending_offline_minutes(last_seen, date(2026, 11, 27), None, now)
    assert only_today == {date(2026, 11, 27): 90}


def test_day_elapsed_min() -> None:
    now = datetime(2026, 11, 27, 10, 0, tzinfo=UTC)  # 15:00 UTC+5
    assert day_elapsed_min(date(2026, 11, 27), now) == 900
    assert day_elapsed_min(date(2026, 11, 26), now) == 1440
    assert day_elapsed_min(date(2026, 11, 28), now) == 0
