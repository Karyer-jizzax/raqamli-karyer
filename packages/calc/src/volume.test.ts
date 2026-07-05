import { describe, expect, it } from 'vitest';

import { computeVolume } from './volume';

describe('computeVolume', () => {
  it('matches the demo seed record (qumshagal, balanced weight → confirm)', () => {
    const r = computeVolume({ materialId: 'qumshagal', density: 1.55, weightKg: 87400 });
    expect(r.volumeFinal).toBeCloseTo(56.39, 1);
    expect(r.status).toBe('confirm');
    expect(r.confidence).toBe(96);
  });

  it('flags a density outside the material range', () => {
    const r = computeVolume({ materialId: 'shagal', density: 2.5, weightKg: 80000 });
    expect(r.status).toBe('flagged');
  });

  it('sends missing weight to inspect', () => {
    const r = computeVolume({ materialId: 'shagal', density: 1.5, weightKg: 0 });
    expect(r.volumeFinal).toBe(0);
    expect(r.status).toBe('inspect');
  });
});
