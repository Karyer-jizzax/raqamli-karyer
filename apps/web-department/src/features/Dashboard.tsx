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
  const { data: overview } = useOverview(
    selected ? { district_id: selected } : regionId ? { region_id: regionId } : {},
  );
  const selectedDistrict = geo?.districts.find((d) => d.id === selected);

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <b style={{ fontFamily: 'var(--mono)' }}>{v}</b>
    </div>
  );
}
