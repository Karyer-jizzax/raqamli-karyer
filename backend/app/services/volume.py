"""Authoritative volume / confidence / status computation.

1:1 port of the demo `compute()` and the TS preview port in `packages/calc`.
This is the single source of truth — the API recomputes on every save and never
trusts client-supplied volume/status. Parity with the TS port is enforced by
`tests/test_volume.py` (shared fixtures with packages/calc/src/volume.test.ts).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class MaterialSpec:
    lo: float  # density range low
    hi: float  # density range high
    is_tent: bool


@dataclass(frozen=True)
class VolumeInput:
    density: float  # rho, t/m³
    weight_kg: float  # wkg
    length_m: float  # L
    width_m: float  # W
    height_m: float  # H


@dataclass(frozen=True)
class VolumeResult:
    volume_camera: float | None  # Vc (None if tent-covered)
    volume_scale: float  # Vw
    volume_final: float  # Vf / m3
    diff_pct: float | None  # diff as a percentage (0..100)
    confidence: float  # vConf %
    status: str  # confirm | flagged | inspect


def _round2(n: float) -> float:
    return round(n * 100) / 100


def compute_volume(inp: VolumeInput, material: MaterialSpec) -> VolumeResult:
    tent = material.is_tent
    rho = inp.density or 0.0
    wt = (inp.weight_kg or 0.0) / 1000.0  # tonnes
    L, W, H = inp.length_m or 0.0, inp.width_m or 0.0, inp.height_m or 0.0

    vc: float | None = None if tent else L * W * H
    vw = wt / rho if rho > 0 else 0.0

    cam_conf = 0.0 if tent else 0.95
    scale_conf = 0.96 if rho > 0 else 0.0

    diff: float | None = None
    if vc is not None and vc > 0 and vw > 0:
        diff = abs(vc - vw) / ((vc + vw) / 2)
        ag = max(0.0, min(1.0, 1 - diff / 0.08))
        vf = (vc * cam_conf + vw * scale_conf) / (cam_conf + scale_conf)
        base = max(cam_conf, scale_conf)
        c = base + ag * (1 - base) * 0.9
        if diff > 0.06:
            c *= max(0.45, 1 - (diff - 0.06) / 0.20)
        v_conf = min(99.5, c * 100)
    else:
        vf = vc if vc else vw
        v_conf = 90.0

    # density sanity check
    rho_meas = wt / vc if vc and vc > 0 else 0.0
    rho_ok = material.lo - 0.06 <= rho_meas <= material.hi + 0.06

    status = "confirm"
    if tent:
        status = "flagged"
    elif diff is not None and diff > 0.12:
        status = "inspect"
    elif diff is not None and diff > 0.06:
        status = "flagged"
    if not rho_ok and vc is not None and vc > 0 and status == "confirm":
        status = "flagged"

    return VolumeResult(
        volume_camera=None if vc is None else _round2(vc),
        volume_scale=_round2(vw),
        volume_final=_round2(vf),
        diff_pct=None if diff is None else _round2(diff * 100),
        confidence=_round2(v_conf),
        status=status,
    )
