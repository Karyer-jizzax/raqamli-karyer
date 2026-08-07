import { type ReportRow, useMaterials, useReport } from '@karier/api-client';
import { currentLang, useTranslation } from '@karier/i18n';
import {
  CHART_CONTEXT,
  CHART_SLOTS,
  ChartCard,
  ChartTable,
  type DateRange,
  DonutChart,
  RankBars,
  type Segment,
  TableSkeleton,
} from '@karier/ui';

/** M2 material · M4 district. */
export type ReportId = 2 | 4;

const TOP_N = 8;

/**
 * One report dimension, as a card.
 *
 * @param metric  Which column the chart plots; the table always carries both.
 * @param view    `bars` ranks the keys against each other and folds the tail
 *                into one row — "who is biggest". `ring` answers the other
 *                question, "split how", and needs `ringColor` to have a stable
 *                color for the dimension's keys.
 */
export function ReportCard({
  n,
  title,
  subtitle,
  range,
  districtId,
  metric = 'count',
  view = 'bars',
  className,
}: {
  n: ReportId;
  title: string;
  subtitle?: string;
  range: DateRange;
  districtId?: string;
  metric?: 'count' | 'volume';
  view?: 'bars' | 'ring';
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
    metric === 'volume'
      ? v.toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
          maximumFractionDigits: 0,
        })
      : v.toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ');

  const label = (key: string): string => {
    if (n === 2) {
      const m = materials?.find((x) => x.id === key);
      if (!m) return key === '—' ? t('dash_unidentified') : key;
      return lang === 'ru' ? m.name_ru : lang === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
    }
    return key;
  };

  /**
   * Ring color per key — bound to the entity, never to this period's ranking,
   * so changing the tuman or the davr never turns Shag'al from blue into teal.
   *
   * The binding is the material's place in the admin's own list (web-main), the
   * one order that holds across every filter. Four materials can carry a color
   * (past that the hues stop being tellable apart in a ring); the rest share the
   * context gray, and the table underneath still lists every one of them.
   */
  const ringColor = (key: string): string | undefined => {
    if (n !== 2) return undefined;
    const i = (materials ?? []).findIndex((m) => m.id === key);
    return i >= 0 && i < CHART_SLOTS.length ? CHART_SLOTS[i] : undefined;
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

  // Ring segments keep the sorted order — the largest arc first reads best —
  // but take their color from the key. Everything without a color collapses into
  // one context-gray segment: two gray arcs would just be one arc anyway.
  const ringSegments: Segment[] = (() => {
    const colored = sorted.filter((r) => ringColor(r.key) && value(r) > 0);
    const rest = sorted.filter((r) => !ringColor(r.key) && value(r) > 0);
    const restTotal = rest.reduce((s, r) => s + value(r), 0);
    return [
      ...colored.map((r) => ({
        key: r.key,
        label: label(r.key),
        value: value(r),
        color: ringColor(r.key)!,
      })),
      ...(restTotal > 0
        ? [
            {
              key: '__rest',
              label: rest.length === 1 ? label(rest[0]!.key) : t('an_other'),
              value: restTotal,
              color: CHART_CONTEXT,
            },
          ]
        : []),
    ];
  })();

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
      ) : view === 'ring' ? (
        <DonutChart
          segments={ringSegments}
          centerLabel={metric === 'volume' ? 'm³' : t('an_events_unit')}
          format={fmt}
        />
      ) : (
        <RankBars rows={barRows} format={fmt} />
      )}
    </ChartCard>
  );
}
