import { type DistrictGeo, useOverview, useRegionGeo, useRegions } from '@karier/api-client';
import { currentLang, formatNumber, useTranslation } from '@karier/i18n';
import { Card, cn, JizzaxMap, useAuth } from '@karier/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function districtName(d: DistrictGeo): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

function StatRow({
  label,
  value,
  icon,
  last,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 py-[11px]',
        !last && 'border-b border-b-[#f1f5f9]',
      )}
    >
      <span className="flex min-w-0 items-center gap-[9px] text-[13.5px] leading-tight font-semibold text-[#0f766e]">
        {icon && <span className="flex shrink-0 text-primary">{icon}</span>}
        {label}
      </span>
      <b className="shrink-0 text-[15px] whitespace-nowrap text-[#0f766e] tabular-nums">{value}</b>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[5px] pl-[26px]">
      <span className="text-[12.5px] leading-tight text-muted-foreground">{label}</span>
      <b className="shrink-0 text-[12.5px] whitespace-nowrap tabular-nums">{value}</b>
    </div>
  );
}

// Simple SVG icons (teal, 1.6px stroke — per mockup)
const IconQuarry = (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="10" width="14" height="8" rx="1" />
    <path d="M6 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
const IconVolume = (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="12" width="5" height="6" rx="1" />
    <rect x="7.5" y="8" width="5" height="10" rx="1" />
    <rect x="13" y="4" width="5" height="14" rx="1" />
  </svg>
);
const IconCamera = (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="6" width="16" height="11" rx="2" />
    <circle cx="10" cy="11.5" r="3" />
  </svg>
);
const IconHome = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9.5 10 3l7 6.5" />
    <path d="M5 8.5V16a1 1 0 0 0 1 1h3v-4.5h2V17h3a1 1 0 0 0 1-1V8.5" />
  </svg>
);

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: regions } = useRegions();
  const regionId = user?.region_id ?? regions?.[0]?.id;
  const regionName = regions?.find((r) => r.id === regionId);

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
  const selectedDistrict = geo?.districts.find((d) => d.id === selected);

  const monthName = (m: number) =>
    new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: 'long' }).format(
      new Date(2000, m - 1, 1),
    );

  const regionTitle =
    regionName
      ? lang === 'ru'
        ? regionName.name_ru
        : lang === 'uz-cyrl'
        ? regionName.name_uz_cyrl
        : regionName.name_uz_latn
      : '';

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);

  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-4 p-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-[5px]">
          <span className="text-xs text-muted-foreground">{t('as_year')}</span>
          <select
            className="h-[38px] min-w-[120px] cursor-pointer rounded-[9px] border border-input bg-white px-3 text-[13.5px]"
            value={period.year}
            onChange={(e) => setPeriod((p) => ({ ...p, year: e.target.value }))}
          >
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-[5px]">
          <span className="text-xs text-muted-foreground">{t('as_month')}</span>
          <select
            className="h-[38px] min-w-[140px] cursor-pointer rounded-[9px] border border-input bg-white px-3 text-[13.5px]"
            value={period.month}
            onChange={(e) => setPeriod((p) => ({ ...p, month: e.target.value }))}
          >
            <option value="">{t('as_all')}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Main 2-column layout */}
      <div className="grid items-start gap-4 md:grid-cols-[296px_1fr]">
        {/* LEFT: Stats panel */}
        <Card className="px-5 py-[18px]">
          {regionTitle && (
            <div className="mb-1.5 border-b-2 border-b-primary pb-2.5 text-sm font-semibold">
              {regionTitle}
            </div>
          )}

          <StatRow icon={IconQuarry} label={t('dash_quarries')} value={fn(overview?.quarries)} />
          <StatRow
            icon={IconVolume}
            label={t('dash_ore_volume')}
            value={`${fn(overview?.total_volume)} m³`}
          />
          <StatRow icon={IconCamera} label={t('dash_cameras')} value={fn(overview?.cameras)} last />
          <SubRow label={t('dash_cameras_active')} value={fn(overview?.cameras_active)} />
          <SubRow label={t('dash_cameras_inactive')} value={fn(overview?.cameras_inactive)} />
        </Card>

        {/* RIGHT: Map + selected district info */}
        <div className="grid gap-4">
          <Card className="relative p-3.5">
            <button
              type="button"
              title={t('dash_all_quarries')}
              onClick={() => setSelected(null)}
              className={cn(
                'absolute top-3.5 right-3.5 z-[1] grid size-[34px] cursor-pointer place-items-center rounded-[9px] border border-[#e2e8f0]',
                selected ? 'bg-primary text-white' : 'bg-white text-primary',
              )}
            >
              {IconHome}
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
              <div className="grid h-[420px] place-items-center text-[13px] text-slate-400">
                {t('loading')}
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-center gap-3.5 border-t border-t-[#f1f5f9] pt-2">
              <span className="text-[11.5px] text-slate-400">Kam</span>
              <div className="h-[9px] w-[150px] rounded-full bg-[linear-gradient(90deg,#e6f7f4,#0d9488)]" />
              <span className="text-[11.5px] text-slate-400">Ko'p karyer</span>
            </div>
          </Card>

          {selectedDistrict && (
            <Card>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h3 className="m-0 text-[15px] font-semibold">{districtName(selectedDistrict)}</h3>
                <span className="text-[11.5px] text-muted-foreground">
                  {t('dash_dblclick_hint')}
                </span>
              </div>
              <Row k={t('dash_quarries')} v={String(selectedDistrict.quarry_count)} />
              <Row k={t('dash_events')} v={String(selectedDistrict.event_count)} />
              <Row k={t('dash_volume')} v={`${fn(overview?.total_volume)} m³`} />
            </Card>
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
