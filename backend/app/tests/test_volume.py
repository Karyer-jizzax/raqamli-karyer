"""Volume computation — parity with the demo formula & the TS port.

These fixtures mirror packages/calc/src/volume.test.ts. No DB required.
"""

from app.services.volume import MaterialSpec, VolumeInput, compute_volume

QUMSHAGAL = MaterialSpec(lo=1.45, hi=1.65, is_tent=False)
SHAGAL = MaterialSpec(lo=1.40, hi=1.60, is_tent=False)
TENT = MaterialSpec(lo=1.40, hi=1.70, is_tent=True)


def test_balanced_sources_confirm() -> None:
    r = compute_volume(
        VolumeInput(density=1.55, weight_kg=87400, length_m=5.64, width_m=2.5, height_m=4.0),
        QUMSHAGAL,
    )
    assert abs(r.volume_scale - 56.39) < 0.1
    assert r.status == "confirm"
    assert 90 < r.confidence <= 99.5


def test_tent_flagged() -> None:
    r = compute_volume(
        VolumeInput(density=1.55, weight_kg=80000, length_m=5, width_m=2.5, height_m=4),
        TENT,
    )
    assert r.volume_camera is None
    assert r.status == "flagged"


def test_large_mismatch_inspect() -> None:
    r = compute_volume(
        VolumeInput(density=1.5, weight_kg=30000, length_m=4, width_m=2.5, height_m=4),
        SHAGAL,
    )
    assert r.diff_pct is not None
    assert r.status == "inspect"


def test_no_density_uses_camera_only() -> None:
    r = compute_volume(
        VolumeInput(density=0, weight_kg=0, length_m=4, width_m=2.5, height_m=4),
        SHAGAL,
    )
    assert r.volume_scale == 0
    assert r.volume_final == 40.0
    assert r.confidence == 90.0
