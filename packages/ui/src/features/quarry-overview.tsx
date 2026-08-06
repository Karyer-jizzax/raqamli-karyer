/**
 * One quarry at a glance: headline counters, registry details, camera health,
 * then the two data grids. web-quarry shows it for the operator's own quarry;
 * web-department shows the same view at the end of its drill-down and passes a
 * breadcrumb in.
 */
import {
  useDistricts,
  useM1,
  useQuarries,
  useQuarryAgent,
  useQuarryStats,
  useRegions,
} from '@karier/api-client';
import { formatDateTime, formatNumber, currentLang, useTranslation } from '@karier/i18n';
import type { StatusKey } from '@karier/types';
import { ActivityIcon, BarChart3Icon, CameraIcon, MountainIcon, TruckIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { BucketColumns, ChartCard, ChartTable, SplitBar, StatTile } from '../charts';
import { cn } from '../lib/utils';
import { type Period, PeriodPicker, periodRange } from '../period';
import { localizedName } from '../primitives';
import { PageHeader, Tabs, UpdatedStamp } from '../shell';
import { Chip, M1_STATUS_TONE, TONE_DOT, TONE_FILL } from '../status';
import { AgentStatusStrip } from './live-view';
import { M1Table } from './m1-table';
import { TripsTable } from './trips-table';

function InfoRow({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2 py-[9px]', !last && 'border-b')}>
      <span className="text-data text-muted-foreground">{label}</span>
      <b className={cn('text-right text-data', accent ? 'text-primary' : 'text-foreground')}>
        {value}
      </b>
    </div>
  );
}

function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-[9px]',
        danger ? 'border-danger/20 bg-danger-tint' : 'bg-surface-subtle',
      )}
    >
      <span className={cn('text-data', danger ? 'text-danger' : 'text-muted-foreground')}>
        {label}:
      </span>
      <b className={cn('text-sm tabular-nums', danger ? 'text-danger' : 'text-foreground')}>
        {value}
      </b>
    </div>
  );
}

/**
 * @param showData  Renders the trips/M-1 tabs underneath. The department's
 *                  drill-down wants them (it is the end of the trail); the
 *                  quarry app does not — there the two grids are their own
 *                  sidebar screens.
 */
export function QuarryOverview({
  quarryId,
  breadcrumb,
  showData = true,
}: {
  quarryId?: string;
  breadcrumb?: ReactNode;
  showData?: boolean;
}) {
  const { t } = useTranslation();
  const lang = currentLang();

  const [period, setPeriod] = useState<Period>({
    year: String(new Date().getFullYear()),
    month: '',
  });
  const range = periodRange(period);

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();
  const { data: quarries } = useQuarries();
  const { data: stat } = useQuarryStats(quarryId, range);
  const { data: agent } = useQuarryAgent(quarryId);
  // The log for the same period — the shape of the working day and the status
  // split come from it, so the picker scopes every number on the screen.
  const { data: log, isFetching: logFetching } = useM1(
    quarryId ? { limit: '500', quarry_id: quarryId, ...range } : { limit: '500', ...range },
  );

  const quarry = quarries?.find((q) => q.id === quarryId);
  const district = districts?.find((d) => d.id === quarry?.district_id);
  const region = regions?.find((r) => r.id === district?.region_id);

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);

  // Shape of the working day: which hours the gate is busy. Derived from the
  // period's log — the API has no hourly endpoint and 500 rows is cheap here.
  const logRows = useMemo(() => log?.rows ?? [], [log]);
  const hourly = useMemo(() => {
    const bins = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}`,
      count: 0,
    }));
    for (const r of logRows) {
      const h = new Date(r.occurred_at).getHours();
      if (!Number.isNaN(h)) bins[h]!.count += 1;
    }
    return bins;
  }, [logRows]);

  const statusSplit = useMemo(() => {
    const order: StatusKey[] = ['confirm', 'flagged', 'inspect', 'no_plate'];
    const counts = new Map<string, number>();
    for (const r of logRows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return order.map((k) => ({
      key: k,
      label: t(`status_${k}`),
      value: counts.get(k) ?? 0,
      color: TONE_FILL[M1_STATUS_TONE[k]],
    }));
  }, [logRows, t]);

  const updatedAt = stat?.last_event_at ? formatDateTime(stat.last_event_at) : '—';
  const quarryName = quarry?.name ?? (quarryId ? t('loading') : '—');
  const suspended = quarry?.status === 'suspended';

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_quarry')}
        title={quarryName}
        breadcrumb={breadcrumb}
        meta={<UpdatedStamp at={updatedAt} />}
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatTile
          icon={BarChart3Icon}
          label={t('dash_ore_volume')}
          value={fn(stat?.volume)}
          unit="m³"
        />
        <StatTile icon={TruckIcon} label={t('dash_trucks_total')} value={fn(stat?.trucks)} />
        <StatTile icon={ActivityIcon} label={t('dash_events')} value={fn(stat?.events)} />
        <StatTile icon={CameraIcon} label={t('dash_cameras')} value={fn(stat?.cameras)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <header className="mb-2.5 flex items-center gap-2 border-b pb-2.5">
            <MountainIcon className="size-5 text-primary" strokeWidth={1.7} />
            <span className="text-data font-bold text-foreground">{t('q_info')}</span>
          </header>
          <InfoRow label={t('q_name')} value={quarryName} accent />
          <InfoRow
            label={t('q_status')}
            value={
              <Chip tone={suspended ? 'danger' : 'success'}>
                {quarry ? t(suspended ? 'q_st_suspended' : 'q_st_active') : '—'}
              </Chip>
            }
          />
          <InfoRow label={t('q_district')} value={district ? localizedName(district) : '—'} />
          <InfoRow label={t('dash_region')} value={region ? localizedName(region) : '—'} last />
          <div className="mt-2.5">
            <StatBox label={t('dash_cameras_active')} value={fn(stat?.cameras_active)} />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold tracking-[-0.01em] text-foreground">
            {t('dash_cargo_info')}{' '}
            <span className="text-data font-normal text-muted-foreground">
              ({t('dash_trucks_plural')})
            </span>
          </h2>

          <p className="m-0 mb-3">
            <span className="text-data text-muted-foreground">{t('dash_trucks_total')}: </span>
            <b className="text-xl text-primary tabular-nums">{fn(stat?.trucks)}</b>
          </p>

          <h3 className="mt-4 mb-2 text-data font-semibold text-foreground">{t('dash_cameras')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: stat?.cameras ?? 0 }, (_, i) => {
              const active = i < (stat?.cameras_active ?? 0);
              return (
                <span
                  key={i}
                  title={quarry ? `${quarry.code}-CAM${i + 1}` : undefined}
                  className="inline-flex items-center gap-[5px] rounded-lg border px-2.5 py-[5px] text-xs text-foreground tabular-nums"
                >
                  <span
                    className={cn(
                      'inline-block size-[9px] rounded-full',
                      TONE_DOT[active ? 'success' : 'danger'],
                    )}
                  />
                  CAM{i + 1}
                </span>
              );
            })}
            {!stat?.cameras && <span className="text-data text-muted-foreground">—</span>}
          </div>

          {/* Tarozi agenti — karyerdagi dastur tirikmi. Kamera chiroqlari
              bazadagi sozlamani ko'rsatadi, bu esa hozirgi haqiqatni: agent
              o'lgan bo'lsa hodisalar ham kelmayotgan bo'ladi (doc.txt §3.3). */}
          {agent?.token_issued_at && (
            <>
              <h3 className="mt-4 mb-2 text-data font-semibold text-foreground">
                {t('agent_section')}
              </h3>
              <AgentStatusStrip status={agent} flat />
            </>
          )}
        </section>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_330px]">
        <ChartCard
          title={t('an_hourly')}
          subtitle={t('an_hourly_hint').replace('{{n}}', String(logRows.length))}
          stale={logFetching}
          table={
            <ChartTable
              head={[t('an_hourly'), t('rep_count')]}
              rows={hourly
                .filter((h) => h.count > 0)
                .map((h) => ({ key: h.hour, label: h.hour, values: [fn(h.count)] }))}
            />
          }
        >
          {logRows.length ? (
            <BucketColumns
              data={hourly}
              xKey="hour"
              valueKey="count"
              format={fn}
              tooltipLabel={t('an_events_unit')}
            />
          ) : (
            <p className="py-12 text-center text-data text-muted-foreground">{t('an_empty')}</p>
          )}
        </ChartCard>

        <ChartCard
          title={t('an_by_status')}
          subtitle={t('rep_count')}
          stale={logFetching}
          table={
            <ChartTable
              head={[t('an_dim'), t('rep_count')]}
              rows={statusSplit.map((s) => ({
                key: s.key,
                label: s.label,
                values: [fn(s.value)],
              }))}
            />
          }
        >
          {logRows.length ? (
            <SplitBar segments={statusSplit} format={fn} />
          ) : (
            <p className="py-12 text-center text-data text-muted-foreground">{t('an_empty')}</p>
          )}
        </ChartCard>
      </div>

      {showData && <DataTabs quarryId={quarryId} />}
    </div>
  );
}

/** Switches between the per-vehicle stage table and the raw M-1 event log. */
function DataTabs({ quarryId }: { quarryId?: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'trips' | 'events'>('trips');
  return (
    <div>
      <div className="mb-2.5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'trips', label: t('nav_data') },
            { value: 'events', label: t('ev_list') },
          ]}
        />
      </div>
      {tab === 'trips' ? <TripsTable quarryId={quarryId} /> : <M1Table quarryId={quarryId} />}
    </div>
  );
}
