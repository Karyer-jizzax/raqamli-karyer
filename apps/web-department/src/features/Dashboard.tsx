import { type DistrictGeo, useOverview, useRegionGeo, useRegions } from '@karier/api-client';
import { currentLang, formatNumber, useTranslation } from '@karier/i18n';
import { Card, JizzaxMap, useAuth } from '@karier/ui';
import { useState } from 'react';

function districtName(d: DistrictGeo): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="">
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#15273c', fontFamily: 'var(--mono)' }}>
        {value}
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: regions } = useRegions();
  const regionId = user?.region_id ?? regions?.[0]?.id;

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

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, color: '#15273c' }}>{t('asosiy_region')}</h2>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
          gap: 12,
        }}
      >
        <Tile label={t('dash_quarries')} value={formatNumber(overview?.quarries ?? 0, lang)} />
        <Tile label={t('dash_volume')} value={formatNumber(overview?.total_volume ?? 0, lang)} />
        <Tile label={t('dash_events')} value={formatNumber(overview?.events ?? 0, lang)} />
        <Tile label={t('dash_cameras')} value={formatNumber(overview?.cameras ?? 0, lang)} />
        <Tile
          label={t('dash_avg_conf')}
          value={`${formatNumber(overview?.avg_confidence ?? 0, lang)}%`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          {geo ? (
            <JizzaxMap
              districts={geo.districts}
              viewHeight={geo.view_height}
              selectedId={selected}
              onSelect={(id) => setSelected((s) => (s === id ? null : id))}
            />
          ) : (
            <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>
          )}
        </Card>

        <Card>
          {selectedDistrict ? (
            <div>
              <h3 style={{ margin: '0 0 10px' }}>{districtName(selectedDistrict)}</h3>
              <Row k={t('dash_quarries')} v={String(selectedDistrict.quarry_count)} />
              <Row k={t('dash_events')} v={String(selectedDistrict.event_count)} />
              <Row
                k={t('dash_volume')}
                v={formatNumber(overview?.total_volume ?? 0, lang)}
              />
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>{t('dash_select_hint')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

const FILTER_LBL: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  color: 'var(--muted)',
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
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <b style={{ fontFamily: 'var(--mono)' }}>{v}</b>
    </div>
  );
}
