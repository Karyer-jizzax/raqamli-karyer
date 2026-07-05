import { type DistrictGeo, useOverview, useRegionGeo, useRegions } from '@karier/api-client';
import { currentLang, formatNumber, useTranslation } from '@karier/i18n';
import { Card, JizzaxMap, useAuth } from '@karier/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function districtName(d: DistrictGeo): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

function StatRow({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 0',
        borderBottom: '1px solid var(--line)',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {icon && (
          <span style={{ color: '#1a5cb8', flexShrink: 0, display: 'flex' }}>{icon}</span>
        )}
        <span
          style={{
            fontSize: 13,
            color: accent ? '#1a5cb8' : 'var(--muted-ink)',
            fontWeight: accent ? 700 : 400,
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
      </div>
      <b
        style={{
          fontFamily: 'var(--mono)',
          fontSize: accent ? 15 : 13,
          color: accent ? '#1a5cb8' : '#15273c',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {value}
      </b>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 0 5px 28px',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--muted-ink)', lineHeight: 1.3 }}>{label}</span>
      <b style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#15273c', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {value}
      </b>
    </div>
  );
}

// Simple SVG icons
const IconQuarry = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="10" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 13v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconVolume = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="12" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="7.5" y="8" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="13" y="4" width="5" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IconCamera = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="6" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="11.5" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 6l1.5-3h3L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconHome = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <path
      d="M3 9.5 10 3l7 6.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 8.5V16a1 1 0 0 0 1 1h3v-4.5h2V17h3a1 1 0 0 0 1-1V8.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={FILTER_LBL}>
            {t('as_year')}
            <select
              style={FILTER_SEL}
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
          <label style={FILTER_LBL}>
            {t('as_month')}
            <select
              style={FILTER_SEL}
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
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT: Stats panel */}
        <Card>
          {regionTitle && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#15273c',
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: '2px solid #1a5cb8',
              }}
            >
              {regionTitle}
            </div>
          )}

          <StatRow
            icon={IconQuarry}
            label={t('dash_quarries')}
            value={fn(overview?.quarries)}
            accent
          />

          <StatRow
            icon={IconVolume}
            label={t('dash_ore_volume')}
            value={`${fn(overview?.total_volume)} m³`}
            accent
          />

          <StatRow
            icon={IconCamera}
            label={t('dash_cameras')}
            value={fn(overview?.cameras)}
            accent
          />
          <SubRow label={t('dash_cameras_active')} value={fn(overview?.cameras_active ?? overview?.cameras)} />
          <div style={{ borderBottom: 'none' }}>
            <SubRow label={t('dash_cameras_inactive')} value={fn(overview?.cameras_inactive)} />
          </div>
        </Card>

        {/* RIGHT: Map + selected district info */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                title={t('dash_all_quarries')}
                onClick={() => setSelected(null)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: selected ? '#1a5cb8' : '#fff',
                  color: selected ? '#fff' : '#1a5cb8',
                  cursor: 'pointer',
                }}
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
                <p style={{ color: 'var(--muted-ink)' }}>{t('loading')}</p>
              )}
            </div>
          </Card>

          {selectedDistrict && (
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <h3 style={{ margin: 0 }}>{districtName(selectedDistrict)}</h3>
                <span style={{ fontSize: 11.5, color: 'var(--muted-ink)' }}>
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

const FILTER_LBL: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  color: 'var(--muted-ink)',
};
const FILTER_SEL: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: '#fff',
  fontFamily: 'inherit',
  fontSize: 13,
};

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ color: 'var(--muted-ink)' }}>{k}</span>
      <b style={{ fontFamily: 'var(--mono)' }}>{v}</b>
    </div>
  );
}
