import { useDistrictsWithQuarries, useDynamics, useOverview } from '@karier/api-client';
import { currentLang, formatNumber, monthName, useTranslation } from '@karier/i18n';
import {
  ChartCard,
  ChartLegend,
  ChartTable,
  deltaPct,
  FilterSelect,
  localizedName,
  PageHeader,
  type Period,
  PeriodPicker,
  periodRange,
  previousPeriod,
  StatTile,
  TrendColumns,
  useAuth,
} from '@karier/ui';
import { ActivityIcon, BarChart3Icon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ReportCard } from './ReportCard';

/**
 * Three questions about one period, each in the form that answers it: how much
 * work came in (columns over the year), what was hauled (a share, so a ring)
 * and where from (a ranking, so bars).
 *
 * Every card reads the same filter row; every chart can flip to its table.
 */
export function Analytics() {
  const { t } = useTranslation();
  const lang = currentLang();
  const { user } = useAuth();
  // Karyeri yo'q tuman tanlagichga kirmaydi — u hamisha bo'sh ekran berardi.
  const { data: districts } = useDistrictsWithQuarries(user?.region_id ?? undefined);
  // Tumanga bog'langan hisob uchun tuman tanlagichi tanlashga hech nima
  // bermaydi — server ham, ro'yxat ham allaqachon bitta tumandan iborat.
  const lockedDistrict = user?.district_id ?? null;

  const [period, setPeriod] = useState<Period>({
    year: String(new Date().getFullYear()),
    month: '',
  });
  const [pickedDistrict, setPickedDistrict] = useState('');
  const district = lockedDistrict ?? pickedDistrict;
  const range = periodRange(period);

  const overviewParams = (p: Period) => ({
    ...(district ? { district_id: district } : {}),
    ...(user?.region_id && !district ? { region_id: user.region_id } : {}),
    year: p.year,
    ...(p.month ? { month: p.month } : {}),
  });
  const { data: overview } = useOverview(overviewParams(period));
  const { data: before } = useOverview(overviewParams(previousPeriod(period)));
  const { data: dynamics, isFetching: dynFetching } = useDynamics({
    year: Number(period.year),
    ...(district ? { district_id: district } : {}),
  });

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);

  // The query covers the whole year, so a month missing from the buckets is a
  // month with nothing in it — worth a gap in the row rather than a shorter
  // axis that quietly hides which months were quiet.
  const trend = useMemo(() => {
    const byMonth = new Map((dynamics?.buckets ?? []).map((b) => [b.month, b]));
    return Array.from({ length: 12 }, (_, i) => {
      const b = byMonth.get(i + 1);
      return {
        month: String(i + 1).padStart(2, '0'),
        name: monthName(i + 1, lang),
        confirmed: b?.confirmed ?? 0,
        unconfirmed: b ? Math.max(0, b.total - b.confirmed) : 0,
      };
    });
  }, [dynamics, lang]);
  const trendSeries = [
    { key: 'unconfirmed', label: t('an_unconfirmed'), color: 'var(--chart-context)' },
    { key: 'confirmed', label: t('an_confirmed'), color: 'var(--primary)' },
  ];

  const hasTrend = (dynamics?.buckets ?? []).length > 0;
  const monthLabel = (m: string) => trend.find((r) => r.month === m)?.name ?? m;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('nav_analytics')}
        subtitle={t('an_subtitle')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            {!lockedDistrict && (
              <div className="w-[170px]">
                <FilterSelect
                  label={t('dash_district')}
                  value={district}
                  onChange={setPickedDistrict}
                  options={(districts ?? []).map((d) => [d.id, localizedName(d)])}
                />
              </div>
            )}
            <PeriodPicker value={period} onChange={setPeriod} />
          </div>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
        <StatTile
          icon={ActivityIcon}
          label={t('dash_events')}
          value={fn(overview?.events)}
          delta={deltaPct(overview?.events, before?.events)}
          deltaLabel={t('an_vs_prev')}
        />
        <StatTile
          icon={BarChart3Icon}
          label={t('dash_ore_volume')}
          value={fn(Math.round(overview?.total_volume ?? 0))}
          unit="m³"
          delta={deltaPct(overview?.total_volume, before?.total_volume)}
          deltaLabel={t('an_vs_prev')}
        />
      </div>

      <ChartCard
        title={`${t('an_dynamics')} · ${period.year}`}
        subtitle={t('an_dynamics_hint')}
        stale={dynFetching}
        legend={
          <ChartLegend items={trendSeries.map((s) => ({ label: s.label, color: s.color }))} />
        }
        table={
          <ChartTable
            head={[t('an_month'), t('an_confirmed'), t('an_unconfirmed')]}
            rows={trend.map((r) => ({
              key: r.month,
              label: r.name,
              values: [fn(r.confirmed), fn(r.unconfirmed)],
            }))}
          />
        }
      >
        {hasTrend ? (
          <TrendColumns
            data={trend}
            series={trendSeries}
            xKey="month"
            format={fn}
            height={260}
            labelFor={monthLabel}
          />
        ) : (
          <p className="py-12 text-center text-data text-muted-foreground">{t('an_empty')}</p>
        )}
      </ChartCard>

      {/* A ranking of districts is a comparison, and a tuman account has
          nothing to compare against — its own bar alone says nothing. Without
          it the ring keeps half the width rather than stretching across. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          n={2}
          title={t('an_by_material')}
          subtitle={t('rep_vol')}
          metric="volume"
          view="ring"
          range={range}
          districtId={district || undefined}
        />
        {!lockedDistrict && (
          <ReportCard
            n={4}
            title={t('an_by_district')}
            subtitle={`${t('rep_vol')} · ${t('an_top_hint')}`}
            metric="volume"
            range={range}
            districtId={district || undefined}
          />
        )}
      </div>
    </div>
  );
}
