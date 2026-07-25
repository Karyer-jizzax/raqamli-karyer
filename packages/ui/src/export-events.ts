// Shared "Hodisalar → Excel" export used by web-department and web-quarry.
// Produces a real .xlsx (SheetJS) from the currently visible M-1 rows so
// numbers stay numeric and Uzbek/Cyrillic text is preserved. The column set
// mirrors the on-screen table; media (photo/video) columns are omitted.
import type { M1Row, Material } from '@karier/api-client';
import type { Lang } from '@karier/types';

type Tr = (key: string) => string;

export interface ExportM1Options {
  rows: M1Row[];
  materials: Material[];
  lang: Lang;
  t: Tr;
  /** quarry_id → name (department view spans many quarries). */
  quarryNames?: Map<string, string>;
  /** department view shows the quarry column + zavod/karyer source. */
  includeQuarry?: boolean;
  includeSource?: boolean;
  /** filename stem; the current date is appended. Default "Hodisalar". */
  fileBase?: string;
}

function materialName(m: Material | undefined, lang: Lang): string {
  if (!m) return '';
  return lang === 'ru' ? m.name_ru : lang === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function num(n: number, digits: number): number | string {
  if (!n || Number.isNaN(n)) return '';
  return Number(n.toFixed(digits));
}

/** Build and trigger a download of the events table as an .xlsx workbook.
 *  xlsx (~400 kB) is loaded on demand so it stays out of the initial bundle. */
export async function exportM1ToExcel(opts: ExportM1Options): Promise<void> {
  const XLSX = await import('xlsx');
  const { rows, materials, lang, t, quarryNames, includeQuarry, includeSource } = opts;

  const matById = new Map<string, Material>();
  materials.forEach((m) => matById.set(m.id, m));

  const vtypeLabel = (v: string) =>
    v === 'truck' ? t('vt_truck') : v === 'car' ? t('vt_car') : v || '';

  const header: string[] = [
    t('th_no'),
    ...(includeQuarry ? [t('q_name')] : []),
    t('th_post'),
    t('th_camera'),
    ...(includeSource ? [t('th_source')] : []),
    t('th_plate'),
    t('th_type'),
    t('th_dir'),
    t('th_time'),
    t('th_m3'),
    t('th_ton'),
    t('th_matname'),
    t('th_stir'),
    t('th_owner'),
  ];

  const body = rows.map((r, i) => {
    const plate =
      r.status === 'no_plate'
        ? t('status_no_plate')
        : `${r.plate_region} ${r.plate_number}`.trim();
    const cells: (string | number)[] = [
      i + 1,
      ...(includeQuarry ? [quarryNames?.get(r.quarry_id) ?? r.quarry_id] : []),
      r.post_code ?? '',
      r.camera_label ?? '',
      ...(includeSource ? [t(r.is_main ? 'grp_zavod' : 'grp_karyer')] : []),
      plate,
      vtypeLabel(r.vtype),
      t(`dir_${r.direction}`),
      `${fmtDate(r.occurred_at)} ${fmtTime(r.occurred_at)}`.trim(),
      num(r.volume_final, 1),
      num(r.weight_kg / 1000, 2),
      r.material_id ? materialName(matById.get(r.material_id), lang) : '',
      r.stir ?? '',
      r.owner_name ?? '',
    ];
    return cells;
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);

  // Column widths (chars) roughly matching content; quarry/source shift the map.
  const widths: number[] = [
    6, // №
    ...(includeQuarry ? [22] : []),
    10, // post
    16, // camera
    ...(includeSource ? [12] : []),
    14, // plate
    12, // type
    12, // direction
    20, // datetime
    9, // m³
    9, // ton
    22, // material
    14, // stir
    22, // owner
  ];
  ws['!cols'] = widths.map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  const sheetName = (t('nav_data') || 'Hodisalar').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const today = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  const base = opts.fileBase ?? 'Hodisalar';
  XLSX.writeFile(wb, `${base}_${stamp}.xlsx`);
}
