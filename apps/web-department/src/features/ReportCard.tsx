import { type ReportRow, useMaterials, useReport } from '@karier/api-client';
import { currentLang, useTranslation } from '@karier/i18n';
import {
  ChartCard,
  ChartTable,
  type DateRange,
  RankBars,
  TableSkeleton,
} from '@karier/ui';

/** M2 material · M3 payer · M4 district. */
export type ReportId = 2 | 3 | 4;

const TOP_N = 8;

/**
 * One report dimension, as a card: ranked bars over an open-ended set of keys,
 * with the tail folded into one row.
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
  className,
}: {
  n: ReportId;
  title: string;
  subtitle?: string;
  range: DateRange;
  districtId?: string;
  metric?: 'count' | 'volume';
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
    return key;
  };

  const rows: ReportRow[] = data?.rows ?? [];
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
      ) : (
        <RankBars rows={barRows} format={fmt} />
      )}
    </ChartCard>
  );
}
