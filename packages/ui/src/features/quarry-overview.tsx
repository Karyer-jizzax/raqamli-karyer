/**
 * One quarry at a glance: headline counters, registry details, camera health,
 * then the two data grids. web-quarry shows it for the operator's own quarry;
 * web-department shows the same view at the end of its drill-down and passes a
 * breadcrumb in.
 */
import { useDistricts, useQuarries, useQuarryStats, useRegions } from '@karier/api-client';
import { formatDateTime, formatNumber, currentLang, useTranslation } from '@karier/i18n';
import {
  ActivityIcon,
  BarChart3Icon,
  CameraIcon,
  type LucideIcon,
  MountainIcon,
  TruckIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { cn } from '../lib/utils';
import { localizedName } from '../primitives';
import { PageHeader, Tabs, UpdatedStamp } from '../shell';
import { Chip, TONE_DOT } from '../status';
import { M1Table } from './m1-table';
import { TripsTable } from './trips-table';

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border bg-card px-[18px] py-4 shadow-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary-tint text-primary">
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <div className="min-w-0">
        <div className="text-xs leading-tight text-muted-foreground">{label}</div>
        <div className="text-xl font-bold text-foreground tabular-nums">
          {value}
          {unit && <span className="ml-1 text-2xs font-semibold text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

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

export function QuarryOverview({
  quarryId,
  breadcrumb,
}: {
  quarryId?: string;
  breadcrumb?: ReactNode;
}) {
  const { t } = useTranslation();
  const lang = currentLang();

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();
  const { data: quarries } = useQuarries();
  const { data: stat } = useQuarryStats(quarryId);

  const quarry = quarries?.find((q) => q.id === quarryId);
  const district = districts?.find((d) => d.id === quarry?.district_id);
  const region = regions?.find((r) => r.id === district?.region_id);

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);
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
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatCard
          icon={BarChart3Icon}
          label={t('dash_ore_volume')}
          value={fn(stat?.volume)}
          unit="m³"
        />
        <StatCard icon={TruckIcon} label={t('dash_trucks_total')} value={fn(stat?.trucks)} />
        <StatCard icon={ActivityIcon} label={t('dash_events')} value={fn(stat?.events)} />
        <StatCard icon={CameraIcon} label={t('dash_cameras')} value={fn(stat?.cameras)} />
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

          <StatBox label={t('dash_unidentified')} value={fn(stat?.unidentified)} danger />

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
        </section>
      </div>

      <DataTabs quarryId={quarryId} />
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
