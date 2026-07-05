"""Authoritative volume / confidence / status computation.

Volume is sourced from the weighbridge (tarozi) only: weight ÷ density.
Camera-based dimension measurement is not part of this calculation — the
camera is only used for plate/material recognition (see `services.detection`).

1:1 port of the TS preview in `packages/calc`. This is the single source of
truth — the API recomputes on every save and never trusts client-supplied
volume/status. Parity with the TS port is enforced by `tests/test_volume.py`
(shared fixtures with packages/calc/src/volume.test.ts).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class MaterialSpec:
    lo: float  # density range low
    hi: float  # density range high


@dataclass(frozen=True)
class VolumeInput:
    density: float  # rho, t/m³
    weight_kg: float  # wkg


@dataclass(frozen=True)
class VolumeResult:
    volume_final: float  # Vf / m3
    confidence: float  # vConf %
    status: str  # confirm | flagged | inspect


def _round2(n: float) -> float:
    return round(n * 100) / 100


def compute_volume(inp: VolumeInput, material: MaterialSpec) -> VolumeResult:
    rho = inp.density or 0.0
    wt = (inp.weight_kg or 0.0) / 1000.0  # tonnes

    vf = wt / rho if rho > 0 else 0.0
    rho_ok = material.lo - 0.06 <= rho <= material.hi + 0.06

    if rho <= 0 or wt <= 0:
        status = "inspect"
        confidence = 0.0
    elif not rho_ok:
        status = "flagged"
        confidence = 80.0
    else:
        status = "confirm"
        confidence = 96.0

    return VolumeResult(
        volume_final=_round2(vf),
        confidence=confidence,
        status=status,
    )
