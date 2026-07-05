// Volume / confidence / status computation — TS port of the backend formula.
//
// Volume is sourced from the weighbridge (tarozi) only: weight ÷ density.
// Camera-based dimension measurement is not part of this calculation.
//
// IMPORTANT: this is a PREVIEW port for the operator UI only. The backend
// (`services/volume.py`) is authoritative and recomputes on save. A parity test
// keeps the two in sync (see volume.test.ts and backend tests/test_volume.py).

import type { StatusKey } from '@karier/types';

import { materialById } from './materials';

export interface VolumeInput {
  materialId: string;
  density: number; // rho, t/m³
  weightKg: number; // wkg
}

export interface VolumeResult {
  volumeFinal: number; // Vf / m3
  confidence: number; // vConf %
  status: StatusKey;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeVolume(input: VolumeInput): VolumeResult {
  const mat = materialById(input.materialId);
  const rho = input.density || 0;
  const wt = (input.weightKg || 0) / 1000; // tonnes

  const vf = rho > 0 ? wt / rho : 0;

  const lo = mat?.lo ?? 0;
  const hi = mat?.hi ?? 9;
  const rhoOk = rho >= lo - 0.06 && rho <= hi + 0.06;

  let status: StatusKey;
  let confidence: number;
  if (rho <= 0 || wt <= 0) {
    status = 'inspect';
    confidence = 0;
  } else if (!rhoOk) {
    status = 'flagged';
    confidence = 80;
  } else {
    status = 'confirm';
    confidence = 96;
  }

  return { volumeFinal: round2(vf), confidence, status };
}
