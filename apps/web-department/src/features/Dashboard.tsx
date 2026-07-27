import { type DistrictGeo, useOverview, useRegionGeo, useRegions } from '@karier/api-client';
import { currentLang, formatNumber, monthName, useTranslation } from '@karier/i18n';
import {
  cn,
  FilterSelect,
  JizzaxMap,
  localizedName,
  PageHeader,
  useAuth,
} from '@karier/ui';
import { BarChart3Icon, CameraIcon, HomeIcon, type LucideIcon, MountainIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function StatRow({
  label,
  value,
  icon: Icon,
  last,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  last?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2 py-[11px]', !last && 'border-b')}>
      <span className="flex min-w-0 items-center gap-[9px] text-data leading-tight font-semibold text-primary">
        {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.8} />}
        {label}
      </span>
      <b className="shrink-0 text-sm whitespace-nowrap text-primary tabular-nums">{value}</b>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[5px] pl-[26px]">
      <span className="text-data leading-tight text-muted-foreground">{label}</span>
      <b className="shrink-0 text-data whitespace-nowrap tabular-nums">{value}</b>
    </div>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: regions } = useRegions();
  const regionId = user?.region_id ?? regions?.[0]?.id;
  const region = regions?.find((r) => r.id === regionId);

  const [selected, setSelected] = useState<string | null>(null);
  const { data: geo } = useRegionGeo(regionId ?? undefined);
  const lang = currentLang();

  const thisYear = new Date().getFullYear();
  const [period, setPeriod] = useState<{ year: string; month: string }>({
    year: String(thisYear),
    month: '',
  });

  const params: { region_id?: string; district_id?: string; year?: string; month?: string } =
    selected ? { district_id: selected } : regionId ? { region_id: regionId } : {};
  if (period.year) params.year = period.year;
  if (period.month) params.month = period.month;
  const { data: overview } = useOverview(params);
  const selectedDistrict = geo?.districts.find((d: DistrictGeo) => d.id === selected);

  const regionTitle = region ? localizedName(region) : '';
  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={regionTitle || t('nav_dashboard')}
        actions={
          <div className="flex items-end gap-2">
            <div className="w-[120px]">
              <FilterSelect
                label={t('as_year')}
                value={period.year}
                allowAll={false}
                onChange={(v) => setPeriod((p) => ({ ...p, year: v }))}
                options={[thisYear, thisYear - 1, thisYear - 2].map((y) => [String(y), String(y)])}
              />
            </div>
            <div className="w-[150px]">
              <FilterSelect
                label={t('as_month')}
                value={period.month}
                onChange={(v) => setPeriod((p) => ({ ...p, month: v }))}
                options={Array.from({ length: 12 }, (_, i) => [
                  String(i + 1),
                  monthName(i + 1, lang),
                ])}
              />
            </div>
          </div>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[296px_1fr]">
        {/* Region totals */}
        <section className="rounded-2xl border bg-card px-5 py-[18px] shadow-card">
          {regionTitle && (
            <div className="mb-1.5 border-b-2 border-b-primary pb-2.5 text-sm font-semibold">
              {regionTitle}
            </div>
          )}
          <StatRow icon={MountainIcon} label={t('dash_quarries')} value={fn(overview?.quarries)} />
          <StatRow
            icon={BarChart3Icon}
            label={t('dash_ore_volume')}
            value={`${fn(overview?.total_volume)} m³`}
          />
          <StatRow icon={CameraIcon} label={t('dash_cameras')} value={fn(overview?.cameras)} last />
          <SubRow label={t('dash_cameras_active')} value={fn(overview?.cameras_active)} />
          <SubRow label={t('dash_cameras_inactive')} value={fn(overview?.cameras_inactive)} />
        </section>

        {/* Map + selected district */}
        <div className="grid gap-4">
          <section className="relative rounded-2xl border bg-card p-3.5 shadow-card">
            <button
              type="button"
              title={t('dash_all_quarries')}
              aria-label={t('dash_all_quarries')}
              aria-pressed={selected === null}
              onClick={() => setSelected(null)}
              className={cn(
                'absolute top-3.5 right-3.5 z-[1] grid size-[34px] cursor-pointer place-items-center rounded-[9px] border',
                'transition-colors active:scale-[0.97]',
                'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
                selected ? 'bg-primary text-primary-foreground' : 'bg-card text-primary',
              )}
            >
              <HomeIcon className="size-[17px]" strokeWidth={1.8} />
            </button>
            {geo ? (
              <JizzaxMap
                districts={geo.districts}
                viewHeight={geo.view_height}
                selectedId={selected}
                onSelect={(id) => setSelected((s) => (s === id ? null : id))}
                onActivate={(id) => navigate(`/dashboard/districts/${id}`)}
                maxHeight={500}
              />
            ) : (
              <div className="h-[420px] animate-pulse rounded-xl bg-secondary" />
            )}
            <div className="mt-1.5 flex items-center justify-center gap-3.5 border-t pt-2">
              <span className="text-2xs text-muted-foreground">{t('dash_scale_low')}</span>
              <div className="h-[9px] w-[150px] rounded-full bg-[linear-gradient(90deg,var(--primary-tint),var(--primary))]" />
              <span className="text-2xs text-muted-foreground">{t('dash_scale_high')}</span>
            </div>
          </section>

          {selectedDistrict && (
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <header className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="m-0 text-base font-semibold tracking-[-0.01em]">
                  {localizedName(selectedDistrict)}
                </h2>
                <span className="text-2xs text-muted-foreground">{t('dash_dblclick_hint')}</span>
              </header>
              <Row k={t('dash_quarries')} v={String(selectedDistrict.quarry_count)} />
              <Row k={t('dash_events')} v={String(selectedDistrict.event_count)} />
              <Row k={t('dash_volume')} v={`${fn(overview?.total_volume)} m³`} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <b className="tabular-nums">{v}</b>
    </div>
  );
}
