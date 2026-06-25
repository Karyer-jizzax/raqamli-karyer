import { describe, expect, it } from 'vitest';

import { computeVolume } from './volume';

describe('computeVolume', () => {
  it('matches the demo seed record (qumshagal, balanced sources → confirm)', () => {
    // Demo: rho 1.55, weight 87400 kg, L×W×H giving Vc ≈ Vw ≈ 56.4 m³
    const r = computeVolume({
      materialId: 'qumshagal',
      density: 1.55,
      weightKg: 87400,
      lengthM: 5.64,
      widthM: 2.5,
      heightM: 4.0,
    });
    expect(r.volumeScale).toBeCloseTo(56.39, 1);
    expect(r.status).toBe('confirm');
    expect(r.confidence).toBeGreaterThan(90);
    expect(r.confidence).toBeLessThanOrEqual(99.5);
  });

  it('flags tent-covered loads (no camera volume)', () => {
    const r = computeVolume({
      materialId: 'tent',
      density: 1.55,
      weightKg: 80000,
      lengthM: 5,
      widthM: 2.5,
      heightM: 4,
    });
    expect(r.volumeCamera).toBeNull();
    expect(r.status).toBe('flagged');
  });

  it('sends large source mismatch to inspect (diff > 12%)', () => {
    const r = computeVolume({
      materialId: 'shagal',
      density: 1.5,
      weightKg: 30000, // Vw=20 m³
      lengthM: 4,
      widthM: 2.5,
      heightM: 4, // Vc=40 m³ → diff ~67%
    });
    expect(r.diffPct).not.toBeNull();
    expect(r.status).toBe('inspect');
  });
});
