import { useDistricts, useDynamics, useOverview } from '@karier/api-client';
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
import { useState } from 'react';

import { ReportCard } from './ReportCard';

/**
 * The reports the paper forms M2–M5 stand for, on one screen and one period.
 * Every card reads the same filter row; every chart can flip to its table.
 */
export function Analytics() {
  const { t } = useTranslation();
  const lang = currentLang();
  const { user } = useAuth();
  const { data: districts } = useDistricts(user?.region_id ?? undefined);

  const [period, setPeriod] = useState<Period>({
    year: String(new Date().getFullYear()),
    month: '',
  });
  const [district, setDistrict] = useState('');
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
  const trend = (dynamics?.buckets ?? []).map((b) => ({
    month: String(b.month).padStart(2, '0'),
    name: monthName(b.month, lang),
    confirmed: b.confirmed,
    unconfirmed: Math.max(0, b.total - b.confirmed),
  }));
  const trendSeries = [
    { key: 'unconfirmed', label: t('an_unconfirmed'), color: 'var(--chart-context)' },
    { key: 'confirmed', label: t('an_confirmed'), color: 'var(--primary)' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('nav_analytics')}
        subtitle={t('an_subtitle')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[170px]">
              <FilterSelect
                label={t('dash_district')}
                value={district}
                onChange={setDistrict}
                options={(districts ?? []).map((d) => [d.id, localizedName(d)])}
              />
            </div>
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
        legend={<ChartLegend items={trendSeries.map((s) => ({ label: s.label, color: s.color }))} />}
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
        {trend.length ? (
          <TrendColumns
            data={trend}
            series={trendSeries}
            xKey="month"
            format={fn}
            height={260}
            labelFor={(m) => trend.find((r) => r.month === m)?.name ?? m}
          />
        ) : (
          <p className="py-12 text-center text-data text-muted-foreground">{t('an_empty')}</p>
        )}
      </ChartCard>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ReportCard
          n={2}
          title={t('an_by_material')}
          subtitle={`${t('rep_vol')} · ${t('an_top_hint')}`}
          metric="volume"
          range={range}
          districtId={district || undefined}
        />
        <ReportCard
          n={4}
          title={t('an_by_district')}
          subtitle={`${t('rep_vol')} · ${t('an_top_hint')}`}
          metric="volume"
          range={range}
          districtId={district || undefined}
        />
        <ReportCard
          n={3}
          title={t('an_by_payer')}
          subtitle={t('rep_count')}
          range={range}
          districtId={district || undefined}
        />
      </div>
    </div>
  );
}
