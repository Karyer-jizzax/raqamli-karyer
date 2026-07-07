import { useDistricts, useQuarries, useQuarryStats, useRegions } from '@karier/api-client';
import { currentLang, formatDateTime, formatNumber, useTranslation } from '@karier/i18n';
import { Card } from '@karier/ui';
import { useNavigate, useParams } from 'react-router-dom';

import { DATA_CSS, M1Table } from './DataM1';

function name(d: { name_ru: string; name_uz_cyrl: string; name_uz_latn: string }): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

const IconHome = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <path d="M3 9.5 10 3l7 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M5 8.5V16a1 1 0 0 0 1 1h3v-4.5h2V17h3a1 1 0 0 0 1-1V8.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IconQuarry = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="10" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 13v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconVolume = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="12" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="7.5" y="8" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="13" y="4" width="5" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IconTruck = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="1" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 8h4l3 3v2h-7V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="5" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="15" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const IconCamera = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="6" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="11.5" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 6l1.5-3h3L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconEvents = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 15l4-5 4 3 6-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function StatCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#eaf1fb',
            color: '#1a5cb8',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-ink)', lineHeight: 1.3 }}>{label}</div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 20, color: '#15273c' }}>
            {value}
            {unit && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-ink)', marginLeft: 4 }}>{unit}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
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
      <span style={{ fontSize: 13, color: 'var(--muted-ink)' }}>{label}</span>
      <b style={{ fontSize: 13.5, color: accent ? '#1a5cb8' : '#15273c', textAlign: 'right' }}>{value}</b>
    </div>
  );
}

function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '9px 12px',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: danger ? '#fdeceb' : '#f6f9fc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12.5, color: danger ? '#c0463c' : 'var(--muted-ink)' }}>{label}:</span>
      <b style={{ fontFamily: 'var(--mono)', fontSize: 14, color: danger ? '#c0463c' : '#15273c' }}>{value}</b>
    </div>
  );
}

export function QuarryDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { districtId, quarryId } = useParams<{ districtId: string; quarryId: string }>();
  const lang = currentLang();

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();
  const { data: quarries } = useQuarries();

  const quarry = quarries?.find((q) => q.id === quarryId);
  const district = districts?.find((d) => d.id === (quarry?.district_id ?? districtId));
  const region = regions?.find((r) => r.id === district?.region_id);

  const { data: stat } = useQuarryStats(quarryId);

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);
  const updatedAt = stat?.last_event_at ? formatDateTime(stat.last_event_at) : '—';
  const regionName = region ? name(region) : '';
  const districtName = district ? name(district) : '';
  const quarryName = quarry?.name ?? t('loading');
  const statusLabel = quarry
    ? quarry.status === 'suspended'
      ? t('q_st_suspended')
      : t('q_st_active')
    : '—';

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Title */}
      <h1 style={{ fontSize: 16, margin: 0, color: '#15273c', fontWeight: 800, textAlign: 'center' }}>
        {t('q_detail_title', { quarry: quarryName })}
      </h1>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            title={t('dash_back')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: '#fff',
              color: '#1a5cb8',
              cursor: 'pointer',
            }}
          >
            {IconHome}
          </button>
          <span style={{ color: 'var(--muted-ink)' }}>{regionName}</span>
          <span style={{ color: 'var(--muted-ink)' }}>/</span>
          <button
            type="button"
            onClick={() => district && navigate(`/dashboard/districts/${district.id}`)}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              color: 'var(--muted-ink)',
              cursor: 'pointer',
              fontSize: 12.5,
              textDecoration: 'underline',
            }}
          >
            {districtName}
          </button>
          <span style={{ color: 'var(--muted-ink)' }}>/</span>
          <b style={{ color: '#15273c' }}>{quarryName}</b>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-ink)' }}>
          {t('as_updated')}: <b style={{ color: '#1a5cb8' }}>{updatedAt}</b>
        </div>
      </div>

      {/* Dashboard stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <StatCard icon={IconVolume} label={t('dash_ore_volume')} value={fn(stat?.volume)} unit="m³" />
        <StatCard icon={IconTruck} label={t('dash_trucks_total')} value={fn(stat?.trucks)} />
        <StatCard icon={IconEvents} label={t('dash_events')} value={fn(stat?.events)} />
        <StatCard icon={IconCamera} label={t('dash_cameras')} value={fn(stat?.cameras)} />
      </div>

      {/* Info + cargo breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Quarry info */}
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span style={{ color: '#1a5cb8', display: 'flex' }}>{IconQuarry}</span>
            <span style={{ fontWeight: 700, color: '#15273c', fontSize: 13 }}>{t('q_info')}</span>
          </div>
          <InfoRow label={t('q_name')} value={quarryName} accent />
          <InfoRow
            label={t('q_status')}
            value={
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: quarry?.status === 'suspended' ? '#fdeceb' : '#e7f6ee',
                  color: quarry?.status === 'suspended' ? '#c0463c' : '#1a8a52',
                }}
              >
                {statusLabel}
              </span>
            }
          />
          <InfoRow label={t('q_district')} value={districtName || '—'} />
          <InfoRow label={t('dash_region')} value={regionName || '—'} />
          <div style={{ marginTop: 10 }}>
            <StatBox label={t('dash_cameras_active')} value={fn(stat?.cameras_active)} />
          </div>
        </Card>

        {/* Cargo breakdown */}
        <Card>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#15273c' }}>
            {t('dash_cargo_info')}{' '}
            <span style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--muted-ink)' }}>({t('dash_trucks_plural')})</span>
          </h3>

          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13.5, color: 'var(--muted-ink)' }}>{t('dash_trucks_total')}: </span>
            <b style={{ fontSize: 19, color: '#1a5cb8', fontFamily: 'var(--mono)' }}>{fn(stat?.trucks)}</b>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderTop: '1px solid var(--line)',
              borderBottom: '1px solid var(--line)',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--muted-ink)' }}>{t('dash_loaded')}:</span>
            <b style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{fn(stat?.loaded)}</b>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <StatBox label={t('dash_not_loaded')} value={fn(stat?.not_loaded)} />
            <StatBox label={t('dash_unidentified')} value={fn(stat?.unidentified)} danger />
          </div>

          <h4 style={{ margin: '16px 0 8px', fontSize: 13, color: '#15273c' }}>{t('dash_cameras')}</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Array.from({ length: stat?.cameras ?? 0 }, (_, i) => {
              const active = i < (stat?.cameras_active ?? 0);
              return (
                <span
                  key={i}
                  title={quarry ? `${quarry.code}-CAM${i + 1}` : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    fontSize: 12,
                    color: '#15273c',
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: active ? '#1fa15a' : '#c0463c',
                      display: 'inline-block',
                    }}
                  />
                  CAM{i + 1}
                </span>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Per-quarry data table (same M1 view as the Data page, scoped here) */}
      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#15273c' }}>{t('nav_data')}</h3>
        <style>{DATA_CSS}</style>
        <M1Table quarryId={quarryId} />
      </div>
    </div>
  );
}
