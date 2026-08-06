import { type ReportRow, useMaterials, useReport } from '@karier/api-client';
import { currentLang, useTranslation } from '@karier/i18n';
import type { StatusKey } from '@karier/types';
import {
  ChartCard,
  ChartTable,
  type DateRange,
  M1_STATUS_TONE,
  RankBars,
  type Segment,
  SplitBar,
  TableSkeleton,
  TONE_FILL,
} from '@karier/ui';

/** M2 material · M3 payer · M4 district · M5 status. */
export type ReportId = 2 | 3 | 4 | 5;

const TOP_N = 8;

/** Which M5 statuses the status report plots; see the filter below. */
const STATUS_SHOWN: readonly string[] = ['confirm', 'no_plate'];

/**
 * One report dimension, as a card. Ranked bars for the open-ended dimensions
 * (material, district) and a part-to-whole bar for status, which is a fixed
 * small set with reserved colors.
 *
 * @param metric  Which column the chart plots; the table always carries both.
 */
export function ReportCard({
  n,
  title,
  subtitle,
  range,
  districtId,
  metric = 'count',
  form = 'bars',
  className,
}: {
  n: ReportId;
  title: string;
  subtitle?: string;
  range: DateRange;
  districtId?: string;
  metric?: 'count' | 'volume';
  form?: 'bars' | 'split';
  className?: string;
}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { data: materials } = useMaterials();
  const { data, isFetching, isPending } = useReport(n, {
    ...range,
    ...(districtId ? { district_id: districtId } : {}),
  });

  const fmt = (v: number) =>
    metric === 'volume' ? v.toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
      maximumFractionDigits: 0,
    }) : v.toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ');

  const label = (key: string): string => {
    if (n === 2) {
      const m = materials?.find((x) => x.id === key);
      if (!m) return key === '—' ? t('dash_unidentified') : key;
      return lang === 'ru' ? m.name_ru : lang === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
    }
    if (n === 3) return key === '—' ? '—' : t(`payer_${key}`);
    if (n === 5) return key === '—' ? '—' : t(`status_${key}`);
    return key;
  };

  // M5 da faqat tasdiqlangan va raqamsiz qatorlar qoladi — qolgan holatlar
  // operatorning ish navbati, departament ko'rsatkichi emas.
  const rows: ReportRow[] = (data?.rows ?? []).filter(
    (r) => n !== 5 || STATUS_SHOWN.includes(r.key),
  );
  const value = (r: ReportRow) => (metric === 'volume' ? r.volume : r.count);
  const sorted = [...rows].sort((a, b) => value(b) - value(a));

  // Past the top N the tail folds into one "Boshqalar" row — never a new color
  // and never a bar too thin to read.
  const head = sorted.slice(0, TOP_N);
  const tail = sorted.slice(TOP_N);
  const barRows = [
    ...head.map((r) => ({ label: label(r.key), value: value(r) })),
    ...(tail.length
      ? [{ label: t('an_other'), value: tail.reduce((s, r) => s + value(r), 0) }]
      : []),
  ].filter((r) => r.value > 0);

  const segments: Segment[] = sorted.map((r) => ({
    key: r.key,
    label: label(r.key),
    value: value(r),
    // Statuses wear the status palette (same tones as the M-1 chips).
    color: TONE_FILL[M1_STATUS_TONE[r.key as StatusKey] ?? 'neutral'] ?? 'var(--chart-context)',
  }));

  const empty = !rows.length;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      stale={isFetching && !isPending}
      className={className}
      table={
        <ChartTable
          head={[t('an_dim'), t('rep_count'), t('rep_vol')]}
          rows={sorted.map((r) => ({
            key: r.key,
            label: label(r.key),
            values: [fmt(r.count), fmt(Math.round(r.volume))],
          }))}
        />
      }
    >
      {isPending ? (
        <TableSkeleton rows={5} cols={2} />
      ) : empty ? (
        <p className="py-12 text-center text-data text-muted-foreground">{t('an_empty')}</p>
      ) : form === 'split' ? (
        <SplitBar segments={segments} format={fmt} />
      ) : (
        <RankBars rows={barRows} format={fmt} />
      )}
    </ChartCard>
  );
}
