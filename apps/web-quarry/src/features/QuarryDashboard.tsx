import { useDistricts, useQuarries, useQuarryStats, useRegions } from '@karier/api-client';
import { currentLang, formatDateTime, formatNumber, useTranslation } from '@karier/i18n';
import { Card, cn, useAuth } from '@karier/ui';

import { M1Table } from './DataM1';
import { TripsTable } from './Trips';

function name(d: { name_ru: string; name_uz_cyrl: string; name_uz_latn: string }): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

const IconQuarry = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="10" width="14" height="8" rx="1" />
    <path d="M6 10V7a4 4 0 0 1 8 0v3" />
    <path d="M10 13v3" strokeLinecap="round" />
  </svg>
);
const IconVolume = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="12" width="5" height="6" rx="1" />
    <rect x="7.5" y="8" width="5" height="10" rx="1" />
    <rect x="13" y="4" width="5" height="14" rx="1" />
  </svg>
);
const IconTruck = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="6" width="10" height="7" rx="1" />
    <path d="M11 8h4l3 3v2h-7V8Z" strokeLinejoin="round" />
    <circle cx="5" cy="15" r="1.6" strokeWidth="1.3" />
    <circle cx="15" cy="15" r="1.6" strokeWidth="1.3" />
  </svg>
);
const IconCamera = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="6" width="16" height="11" rx="2" />
    <circle cx="10" cy="11.5" r="3" />
    <path d="M7 6l1.5-3h3L13 6" strokeLinecap="round" />
  </svg>
);
const IconEvents = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 15l4-5 4 3 6-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function StatCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <Card className="rounded-[14px] px-[18px] py-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary-tint text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-xs leading-tight text-muted-foreground">{label}</div>
          <div className="text-xl font-bold text-foreground tabular-nums">
            {value}
            {unit && (
              <span className="ml-1 text-xs font-semibold text-muted-foreground">{unit}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 py-[9px]',
        !last && 'border-b border-b-[#f1f5f9]',
      )}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <b className={cn('text-right text-[13.5px]', accent ? 'text-primary' : 'text-foreground')}>
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
        danger ? 'bg-[#fff1f2]' : 'bg-slate-50',
      )}
    >
      <span className={cn('text-[12.5px]', danger ? 'text-[#e11d48]' : 'text-muted-foreground')}>
        {label}:
      </span>
      <b className={cn('text-sm tabular-nums', danger ? 'text-[#e11d48]' : 'text-foreground')}>
        {value}
      </b>
    </div>
  );
}

export function QuarryDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const quarryId = user?.quarry_id ?? undefined;
  const lang = currentLang();

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();
  const { data: quarries } = useQuarries();

  const quarry = quarries?.find((q) => q.id === quarryId);
  const district = districts?.find((d) => d.id === quarry?.district_id);
  const region = regions?.find((r) => r.id === district?.region_id);

  const { data: stat } = useQuarryStats(quarryId);

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);
  const updatedAt = stat?.last_event_at ? formatDateTime(stat.last_event_at) : '—';
  const regionName = region ? name(region) : '';
  const districtName = district ? name(district) : '';
  const quarryName = quarry?.name ?? (quarryId ? t('loading') : '—');
  const statusLabel = quarry
    ? quarry.status === 'suspended'
      ? t('q_st_suspended')
      : t('q_st_active')
    : '—';

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-4 p-6">
      {/* Title */}
      <h1 className="m-0 text-center text-base font-semibold text-foreground">
        {t('q_detail_title', { quarry: quarryName })}
      </h1>

      {/* Updated-at stamp (the department page shows it next to the breadcrumb; here it stands alone) */}
      <div className="flex justify-end text-xs text-muted-foreground">
        <span>
          {t('as_updated')}: <b className="text-primary">{updatedAt}</b>
        </span>
      </div>

      {/* Dashboard stat cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard icon={IconVolume} label={t('dash_ore_volume')} value={fn(stat?.volume)} unit="m³" />
        <StatCard icon={IconTruck} label={t('dash_trucks_total')} value={fn(stat?.trucks)} />
        <StatCard icon={IconEvents} label={t('dash_events')} value={fn(stat?.events)} />
        <StatCard icon={IconCamera} label={t('dash_cameras')} value={fn(stat?.cameras)} />
      </div>

      {/* Info + cargo breakdown */}
      <div className="grid items-start gap-4 md:grid-cols-[300px_1fr]">
        {/* Quarry info */}
        <Card>
          <div className="mb-2.5 flex items-center gap-2 border-b border-b-[#f1f5f9] pb-2.5">
            <span className="flex text-primary">{IconQuarry}</span>
            <span className="text-[13px] font-bold text-foreground">{t('q_info')}</span>
          </div>
          <InfoRow label={t('q_name')} value={quarryName} accent />
          <InfoRow
            label={t('q_status')}
            value={
              <span
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  quarry?.status === 'suspended'
                    ? 'bg-[#fff1f2] text-[#e11d48]'
                    : 'bg-[#ecfdf5] text-[#059669]',
                )}
              >
                {statusLabel}
              </span>
            }
          />
          <InfoRow label={t('q_district')} value={districtName || '—'} />
          <InfoRow label={t('dash_region')} value={regionName || '—'} last />
          <div className="mt-2.5">
            <StatBox label={t('dash_cameras_active')} value={fn(stat?.cameras_active)} />
          </div>
        </Card>

        {/* Cargo breakdown */}
        <Card>
          <h3 className="mb-3 text-[15px] font-semibold text-foreground">
            {t('dash_cargo_info')}{' '}
            <span className="text-[12.5px] font-normal text-muted-foreground">
              ({t('dash_trucks_plural')})
            </span>
          </h3>

          <div className="mb-3">
            <span className="text-[13.5px] text-muted-foreground">{t('dash_trucks_total')}: </span>
            <b className="text-[19px] text-primary tabular-nums">{fn(stat?.trucks)}</b>
          </div>

          <div className="mb-1 flex justify-between border-y border-y-[#f1f5f9] py-2">
            <span className="text-[13px] text-muted-foreground">{t('dash_loaded')}:</span>
            <b className="text-sm tabular-nums">{fn(stat?.loaded)}</b>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <StatBox label={t('dash_not_loaded')} value={fn(stat?.not_loaded)} />
            <StatBox label={t('dash_unidentified')} value={fn(stat?.unidentified)} danger />
          </div>

          <h4 className="mt-4 mb-2 text-[13px] font-semibold text-foreground">
            {t('dash_cameras')}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: stat?.cameras ?? 0 }, (_, i) => {
              const active = i < (stat?.cameras_active ?? 0);
              return (
                <span
                  key={i}
                  title={quarry ? `${quarry.code}-CAM${i + 1}` : undefined}
                  className="inline-flex items-center gap-[5px] rounded-lg border px-2.5 py-[5px] text-xs text-foreground"
                >
                  <span
                    className={cn(
                      'inline-block size-[9px] rounded-full',
                      active ? 'bg-[#059669]' : 'bg-[#e11d48]',
                    )}
                  />
                  CAM{i + 1}
                </span>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Ma'lumotlar: per-vehicle stage table (trips) — stage columns fill as
          the vehicle passes each checkpoint */}
      <div>
        <h3 className="mb-2.5 text-[15px] font-semibold text-foreground">{t('nav_data')}</h3>
        <TripsTable quarryId={quarryId} />
      </div>

      {/* Raw event log (M-1 grid: material, volume, AI status) */}
      <div>
        <h3 className="mb-2.5 text-[15px] font-semibold text-foreground">{t('ev_list')}</h3>
        <M1Table quarryId={quarryId} />
      </div>
    </div>
  );
}
