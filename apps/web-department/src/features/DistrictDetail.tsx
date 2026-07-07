import { type CargoPost, useDistrictCargo, useDistricts, useRegions } from '@karier/api-client';
import { currentLang, formatDateTime, formatNumber, useTranslation } from '@karier/i18n';
import { Card } from '@karier/ui';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function name(d: { name_ru: string; name_uz_cyrl: string; name_uz_latn: string }): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const DEFAULT_RANGE = {
  from: `${new Date().getFullYear()}-01-01`,
  to: isoDay(new Date()),
};

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
const IconEvents = (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
    <path d="M3 15l4-5 4 3 6-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconTruck = (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
    <rect x="1" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 8h4l3 3v2h-7V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="5" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="15" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

function EcoPostCard({
  post,
  t,
  lang,
}: {
  post: CargoPost;
  t: (k: string) => string;
  lang: ReturnType<typeof currentLang>;
}) {
  return (
    <div
      style={{
        minWidth: 132,
        flexShrink: 0,
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '10px 12px',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          background: '#eaf1fb',
          color: '#1a5cb8',
          fontFamily: 'var(--mono)',
          fontSize: 11.5,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 999,
          marginBottom: 8,
        }}
      >
        {post.code}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#15273c', marginBottom: 3 }}>
        <span style={{ color: '#1a5cb8', display: 'flex' }}>{IconEvents}</span>
        <b style={{ fontFamily: 'var(--mono)' }}>{formatNumber(post.events, lang)}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#15273c', marginBottom: 8 }}>
        <span style={{ color: '#1a5cb8', display: 'flex' }}>{IconTruck}</span>
        <b style={{ fontFamily: 'var(--mono)' }}>{formatNumber(post.trucks, lang)}</b>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted-ink)', marginBottom: 4 }}>{t('dash_cameras')}:</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: post.cameras }, (_, i) => (
          <span
            key={i}
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: i < post.cameras_active ? '#1fa15a' : '#c0463c',
              display: 'inline-block',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CargoTable({
  t,
  fn,
  rows,
  onRowClick,
}: {
  t: (k: string) => string;
  fn: (v: number) => string;
  rows: { id: string; label: string; count: number; volume: number }[];
  onRowClick?: (id: string) => void;
}) {
  const th: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--muted-ink)',
    padding: '4px 8px',
    textAlign: 'center',
    borderBottom: '1px solid var(--line)',
  };
  const td: React.CSSProperties = { padding: '8px', fontSize: 13, borderBottom: '1px solid var(--line)' };
  const tdNum: React.CSSProperties = { ...td, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700 };
  const tdMuted: React.CSSProperties = { ...tdNum, color: 'var(--muted-ink)', fontWeight: 400 };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
      <thead>
        <tr>
          <th style={th} />
          <th style={th} colSpan={2}>
            {t('dash_ettyu')}
          </th>
          <th style={th} colSpan={2}>
            {t('dash_diff')}
          </th>
        </tr>
        <tr>
          <th style={th} />
          <th style={th}>{t('rep_count')}</th>
          <th style={th}>{t('rep_vol')}</th>
          <th style={th}>{t('rep_count')}</th>
          <th style={th}>{t('rep_vol')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            onClick={onRowClick ? () => onRowClick(r.id) : undefined}
            title={onRowClick ? t('q_open_hint') : undefined}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            <td
              style={{
                ...td,
                fontWeight: 600,
                color: onRowClick ? '#1a5cb8' : '#15273c',
                textDecoration: onRowClick ? 'underline' : undefined,
              }}
            >
              {r.label}
            </td>
            <td style={tdNum}>{fn(r.count)}</td>
            <td style={tdNum}>{fn(r.volume)}</td>
            <td style={tdMuted}>-</td>
            <td style={tdMuted}>-</td>
          </tr>
        ))}
      </tbody>
    </table>
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

export function DistrictDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { districtId } = useParams<{ districtId: string }>();
  const lang = currentLang();

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();

  const [range, setRange] = useState(DEFAULT_RANGE);
  const { data: cargo } = useDistrictCargo(districtId, {
    date_from: range.from || undefined,
    date_to: range.to || undefined,
  });

  const district = districts?.find((d) => d.id === districtId);
  const region = regions?.find((r) => r.id === district?.region_id);
  const posts = cargo?.posts ?? [];
  const quarryCargoRows = useMemo(
    () =>
      (cargo?.quarries ?? []).map((q) => ({
        id: q.id,
        label: q.name,
        count: q.count,
        volume: q.volume,
      })),
    [cargo?.quarries],
  );

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);
  const regionName = region ? name(region) : '';
  const districtDisplayName = district ? name(district) : t('loading');
  const updatedAt = cargo?.last_event_at ? formatDateTime(cargo.last_event_at) : '—';

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Title */}
      <h1 style={{ fontSize: 16, margin: 0, color: '#15273c', fontWeight: 800, textAlign: 'center' }}>
        {t('dash_detail_title', { region: regionName, district: districtDisplayName })}
      </h1>

      {/* Date range + breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            style={FILTER_SEL}
          />
          <span style={{ color: 'var(--muted-ink)' }}>—</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            style={FILTER_SEL}
          />
        </div>
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
          <b style={{ color: '#15273c' }}>{districtDisplayName}</b>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted-ink)', marginTop: -8 }}>
        {t('as_updated')}: <b style={{ color: '#1a5cb8' }}>{updatedAt}</b>
      </div>

      {/* Eco-post cards strip */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {posts.map((p) => (
          <EcoPostCard key={p.id} post={p} t={t} lang={lang} />
        ))}
        {posts.length === 0 && (
          <p style={{ color: 'var(--muted-ink)', fontSize: 13, margin: 0 }}>{t('q_empty')}</p>
        )}
      </div>

      {/* Jami + cargo breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
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
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a5cb8', display: 'inline-block' }} />
            <span style={{ fontWeight: 700, color: '#15273c', fontSize: 13 }}>{t('jami')}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 17, color: '#15273c' }}>
              {fn(posts.reduce((s, p) => s + p.trucks, 0))}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {posts.map((p) => (
              <div key={p.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      border: '1.5px solid var(--line)',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#15273c' }}>{p.code}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b style={{ fontFamily: 'var(--mono)', fontSize: 13.5, color: '#1a5cb8' }}>{fn(p.trucks)}</b>
                  <span style={{ color: '#1a5cb8', display: 'flex' }}>{IconTruck}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#15273c' }}>
            {t('dash_cargo_info')}{' '}
            <span style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--muted-ink)' }}>
              ({t('dash_trucks_plural')})
            </span>
          </h3>

          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13.5, color: 'var(--muted-ink)' }}>{t('dash_trucks_total')}: </span>
            <b style={{ fontSize: 19, color: '#1a5cb8', fontFamily: 'var(--mono)' }}>{fn(cargo?.trucks_total)}</b>
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
            <b style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{fn(cargo?.loaded)}</b>
          </div>

          {quarryCargoRows.length > 0 ? (
            <CargoTable
              t={t}
              fn={fn}
              rows={quarryCargoRows}
              onRowClick={(id) => navigate(`/dashboard/districts/${districtId}/quarries/${id}`)}
            />
          ) : (
            <p style={{ color: 'var(--muted-ink)', fontSize: 13, margin: '10px 0 0' }}>{t('q_empty')}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <StatBox label={t('dash_not_loaded')} value={fn(cargo?.not_loaded)} />
            <StatBox label={t('dash_unidentified')} value={fn(cargo?.unidentified)} danger />
          </div>
        </Card>
      </div>
    </div>
  );
}

const FILTER_SEL: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: '#fff',
  fontFamily: 'inherit',
  fontSize: 13,
};
