import { useM1, useMaterials } from '@karier/api-client';
import { currentLang, formatNumber, useTranslation } from '@karier/i18n';
import { Card, StatusPill } from '@karier/ui';
import { useState } from 'react';

const STATUSES = ['confirm', 'flagged', 'inspect'] as const;
const DIRECTIONS = ['exit', 'enter'] as const;
const PAYERS = ['legal', 'indiv', 'yatt'] as const;

export function DataM1() {
  const { t } = useTranslation();
  const { data: materials } = useMaterials();
  const lang = currentLang();
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) =>
    setF((p) => {
      const n = { ...p };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });

  const { data, isLoading } = useM1(f);

  return (
    <div style={{ padding: 24, display: 'grid', gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <Sel label={t('flt_status')} value={f.status} onChange={set('status')}
            opts={STATUSES.map((s) => [s, t(`status_${s}`)])} t={t} />
          <Sel label={t('flt_direction')} value={f.direction} onChange={set('direction')}
            opts={DIRECTIONS.map((d) => [d, t(`dir_${d}`)])} t={t} />
          <Sel label={t('flt_payer')} value={f.payer_type} onChange={set('payer_type')}
            opts={PAYERS.map((p) => [p, p])} t={t} />
          <Sel label={t('flt_material')} value={f.material_id} onChange={set('material_id')}
            opts={(materials ?? []).map((m) => [
              m.id,
              lang === 'ru' ? m.name_ru : lang === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn,
            ])} t={t} />
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
            {t('flt_plate')}
            <input value={f.plate ?? ''} onChange={(e) => set('plate')(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
          </label>
          <button onClick={() => setF({})}
            style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--muted)', fontWeight: 600 }}>
            {t('flt_clear')}
          </button>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11 }}>
                  <th style={th}>{t('ev_plate_number')}</th>
                  <th style={th}>{t('ev_model')}</th>
                  <th style={th}>{t('flt_direction')}</th>
                  <th style={th}>{t('ev_vol_final')}</th>
                  <th style={th}>{t('ev_conf')}</th>
                  <th style={th}>{t('q_status')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((e) => (
                  <tr key={e.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ ...td, fontFamily: 'var(--mono)' }}>
                      {e.plate_region} {e.plate_number}
                    </td>
                    <td style={td}>{e.model}</td>
                    <td style={td}>{t(`dir_${e.direction}`)}</td>
                    <td style={{ ...td, fontFamily: 'var(--mono)' }}>{e.volume_final} m³</td>
                    <td style={{ ...td, fontFamily: 'var(--mono)' }}>{e.volume_confidence}%</td>
                    <td style={td}>
                      <StatusPill status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 800 }}>
                  <td style={td} colSpan={3}>
                    {t('m1_total')} ({data?.total_count ?? 0})
                  </td>
                  <td style={{ ...td, fontFamily: 'var(--mono)' }} colSpan={3}>
                    {formatNumber(data?.total_volume ?? 0, lang)} m³
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Sel({
  label,
  value,
  onChange,
  opts,
  t,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  opts: [string, string][];
  t: (k: string) => string;
}) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
      >
        <option value="">{t('flt_all')}</option>
        {opts.map(([v, lbl]) => (
          <option key={v} value={v}>
            {lbl}
          </option>
        ))}
      </select>
    </label>
  );
}

const th: React.CSSProperties = { padding: '6px 10px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '9px 10px' };
