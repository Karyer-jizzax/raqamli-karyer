/** Uzbek number-plate rendering (O'zDSt 1087 kinds).
 *
 * The number part alone tells the owner kind, so the badge classifies and
 * formats it per the national standard:
 *   indiv  A123BC  -> "A 123 BC"  (jismoniy shaxs, white)
 *   legal  123ABC  -> "123 ABC"   (yuridik shaxs, yellow tint)
 *   dav    123DAV  -> "123 DAV"   (davlat organi, 2021 "DAV" series, green tint)
 *   other  anything else, shown as-is (ANPR noise / special series)
 */
import { useTranslation } from '@karier/i18n';

import { cn } from './lib/utils';

export type PlateKind = 'indiv' | 'legal' | 'dav' | 'other';

export function classifyPlate(plateNumber: string): PlateKind {
  const n = plateNumber.replace(/\s+/g, '').toUpperCase();
  if (/^\d{3}DAV$/.test(n)) return 'dav';
  if (/^[A-Z]\d{3}[A-Z]{2}$/.test(n)) return 'indiv';
  if (/^\d{3}[A-Z]{3}$/.test(n)) return 'legal';
  return 'other';
}

export function formatPlateNumber(plateNumber: string): string {
  const n = plateNumber.replace(/\s+/g, '').toUpperCase();
  switch (classifyPlate(n)) {
    case 'indiv':
      return `${n[0]} ${n.slice(1, 4)} ${n.slice(4)}`;
    case 'legal':
    case 'dav':
      return `${n.slice(0, 3)} ${n.slice(3)}`;
    default:
      return plateNumber;
  }
}

const KIND_BG: Record<PlateKind, string> = {
  indiv: 'bg-white',
  legal: 'bg-[#fef08a]',
  dav: 'bg-[#bbf7d0]',
  other: 'bg-white',
};

export function PlateBadge({
  region,
  number,
  className,
}: {
  region: string;
  number: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const kind = classifyPlate(number);
  return (
    <span
      title={t(`plate_kind_${kind}`)}
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-[5px] border-[1.5px] border-[#1e293b] text-[11.5px] leading-none font-bold',
        className,
      )}
    >
      <span className="bg-[#1e293b] px-[5px] py-1 text-white">{region}</span>
      <span className={cn('px-1.5 py-1 text-[#0f172a]', KIND_BG[kind])}>
        {formatPlateNumber(number)}
      </span>
      <span className="flex items-center bg-primary px-1 text-[8.5px] text-white">UZ</span>
    </span>
  );
}
