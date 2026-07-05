"""Volume computation — parity with the TS port.

These fixtures mirror packages/calc/src/volume.test.ts. No DB required.
"""

from app.services.volume import MaterialSpec, VolumeInput, compute_volume

QUMSHAGAL = MaterialSpec(lo=1.45, hi=1.65)
SHAGAL = MaterialSpec(lo=1.40, hi=1.60)


def test_balanced_weight_confirm() -> None:
    r = compute_volume(VolumeInput(density=1.55, weight_kg=87400), QUMSHAGAL)
    assert abs(r.volume_final - 56.39) < 0.1
    assert r.status == "confirm"
    assert r.confidence == 96.0


def test_density_outside_range_flagged() -> None:
    r = compute_volume(VolumeInput(density=2.5, weight_kg=80000), SHAGAL)
    assert r.status == "flagged"


def test_missing_weight_inspect() -> None:
    r = compute_volume(VolumeInput(density=1.5, weight_kg=0), SHAGAL)
    assert r.volume_final == 0
    assert r.status == "inspect"
    assert r.confidence == 0.0


def test_missing_density_inspect() -> None:
    r = compute_volume(VolumeInput(density=0, weight_kg=30000), SHAGAL)
    assert r.volume_final == 0
    assert r.status == "inspect"
