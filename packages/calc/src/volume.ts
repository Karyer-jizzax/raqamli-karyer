// Volume / confidence / status computation — TS port of the demo `compute()`.
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
  lengthM: number; // L
  widthM: number; // W
  heightM: number; // H
}

export interface VolumeResult {
  volumeCamera: number | null; // Vc (null if tent-covered)
  volumeScale: number; // Vw
  volumeFinal: number; // Vf / m3
  diffPct: number | null; // diff (fraction, 0..1)
  confidence: number; // vConf %
  status: StatusKey;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeVolume(input: VolumeInput): VolumeResult {
  const mat = materialById(input.materialId);
  const tent = mat?.tent ?? false;
  const rho = input.density || 0;
  const wt = (input.weightKg || 0) / 1000; // tonnes
  const L = input.lengthM || 0;
  const W = input.widthM || 0;
  const H = input.heightM || 0;

  const Vc = tent ? null : L * W * H;
  const Vw = rho > 0 ? wt / rho : 0;

  const camConf = tent ? 0 : 0.95;
  const scaleConf = rho > 0 ? 0.96 : 0;

  let Vf: number;
  let vConf: number;
  let diff: number | null = null;

  if (Vc !== null && Vc > 0 && Vw > 0) {
    diff = Math.abs(Vc - Vw) / ((Vc + Vw) / 2);
    const ag = Math.max(0, Math.min(1, 1 - diff / 0.08));
    Vf = (Vc * camConf + Vw * scaleConf) / (camConf + scaleConf);
    const base = Math.max(camConf, scaleConf);
    let c = base + ag * (1 - base) * 0.9;
    if (diff > 0.06) c *= Math.max(0.45, 1 - (diff - 0.06) / 0.2);
    vConf = Math.min(99.5, c * 100);
  } else {
    Vf = Vc || Vw;
    vConf = 90;
  }

  // Density sanity check
  const rhoMeas = Vc && Vc > 0 ? wt / Vc : 0;
  const lo = mat?.lo ?? 0;
  const hi = mat?.hi ?? 9;
  const rhoOk = rhoMeas >= lo - 0.06 && rhoMeas <= hi + 0.06;

  // Status rules
  let status: StatusKey = 'confirm';
  if (tent) {
    status = 'flagged';
  } else if (diff !== null && diff > 0.12) {
    status = 'inspect';
  } else if (diff !== null && diff > 0.06) {
    status = 'flagged';
  }
  if (!rhoOk && Vc !== null && Vc > 0 && status === 'confirm') {
    status = 'flagged';
  }

  return {
    volumeCamera: Vc === null ? null : round2(Vc),
    volumeScale: round2(Vw),
    volumeFinal: round2(Vf),
    diffPct: diff === null ? null : round2(diff * 100),
    confidence: round2(vConf),
    status,
  };
}
