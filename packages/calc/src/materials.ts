// Material density table — mirrors the demo MATS array and the backend seed.

export interface MaterialDef {
  id: string;
  rho: number; // default density t/m³
  lo: number; // density range low
  hi: number; // density range high
  tent: boolean;
}

export const MATERIALS: Record<string, MaterialDef> = {
  shagal: { id: 'shagal', rho: 1.5, lo: 1.4, hi: 1.6, tent: false },
  qumshagal: { id: 'qumshagal', rho: 1.55, lo: 1.45, hi: 1.65, tent: false },
  qurilishqum: { id: 'qurilishqum', rho: 1.6, lo: 1.5, hi: 1.7, tent: false },
  tosh: { id: 'tosh', rho: 1.7, lo: 1.6, hi: 1.8, tent: false },
  ohak: { id: 'ohak', rho: 0.5, lo: 0.45, hi: 0.6, tent: false },
  tent: { id: 'tent', rho: 1.55, lo: 1.4, hi: 1.7, tent: true },
};

export function materialById(id: string): MaterialDef | undefined {
  return MATERIALS[id];
}
