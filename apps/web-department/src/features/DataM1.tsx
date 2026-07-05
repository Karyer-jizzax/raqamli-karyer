import { type M1Row, type Material, useM1, useMaterials } from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import { Card } from '@karier/ui';
import { useMemo, useState } from 'react';

import cam1Mp4 from '../assets/video/cam1.mp4';
import cam1Webm from '../assets/video/cam1.webm';
import poster1 from '../assets/video/poster1.jpg';

// Table chrome that can't be expressed inline (sticky-ish header, hover, group
// tints, control styling). Injected once.
export const DATA_CSS = `
.m1-table{width:100%;border-collapse:collapse;font-size:12.5px;white-space:nowrap}
.m1-table th,.m1-table td{border:1px solid var(--line);padding:7px 9px}
.m1-table thead th{background:#f4f7fb;color:#2a3f57;font-weight:700;font-size:11.5px;text-align:center}
.m1-table thead .grp-ai{background:#eef5fc}
.m1-table thead .grp-mat{background:#fff6ea}
.m1-table thead .grp-yhxx{background:#f0f1f6}
.m1-table tbody tr:hover{background:#f8fbff}
.m1-table td.ctr{text-align:center}
.m1-table td.num{text-align:right;font-family:var(--mono)}
.m1-table tfoot td{background:#eef5fc;font-weight:800;border-top:2px solid var(--line)}
.m1-ic{width:30px;height:30px;border:1px solid var(--line);background:#fff;border-radius:8px;display:inline-grid;place-items:center;cursor:pointer;color:var(--brand)}
.m1-ic:hover{border-color:var(--brand)}
.m1-fctrl{padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:#fff;font-family:inherit}
.m1-fctrl:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,95,168,.13)}
.m1-plate{display:inline-flex;align-items:stretch;border:1.5px solid #2b2b2b;border-radius:5px;overflow:hidden;font-family:var(--mono);font-weight:700;font-size:12px;line-height:1}
.m1-plate .reg{background:#2b2b2b;color:#fff;padding:3px 5px}
.m1-plate .nm{padding:3px 6px;color:#15273c}
.m1-plate .uz{background:#1565c0;color:#fff;padding:3px 4px;font-size:9px;display:flex;align-items:center}
.m1-mwrap{position:fixed;inset:0;z-index:120;background:rgba(7,13,20,.6);display:grid;place-items:center;padding:20px}
.m1-mcard{background:#fff;border-radius:14px;overflow:hidden;max-width:640px;width:100%;box-shadow:0 24px 60px rgba(8,25,50,.4)}
.m1-mhead{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);font-weight:700}
.m1-mx{border:none;background:#f0f3f8;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:15px}
.m1-plate-btn{border:none;background:none;padding:0;cursor:pointer}
.m1-plate-btn:hover .m1-plate{box-shadow:0 0 0 2px rgba(30,95,168,.35)}
.m1-hist-card{max-width:820px}
`;

const STATUSES = ['confirm', 'flagged', 'inspect'] as const;
const DIRECTIONS = ['exit', 'enter'] as const;
const LOADS = ['yes', 'no'] as const;

type Lang = ReturnType<typeof currentLang>;

function materialName(m: Material | undefined, lang: Lang): string {
  if (!m) return '-';
  return lang === 'ru' ? m.name_ru : lang === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
}

function fmtDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
  };
}

const EYE =
  '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
const PLAY = '<path d="M6 4v16l14-8z"/>';

function Glyph({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

function Plate({ row }: { row: M1Row }) {
  return (
    <span className="m1-plate">
      <span className="reg">{row.plate_region}</span>
      <span className="nm">{row.plate_number}</span>
      <span className="uz">UZ</span>
    </span>
  );
}

export function DataM1() {
  return (
    <div style={{ padding: 24, display: 'grid', gap: 14 }}>
      <style>{DATA_CSS}</style>
      <M1Table />
    </div>
  );
}

export function M1Table({ quarryId }: { quarryId?: string } = {}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { data: materials } = useMaterials();
  const { data, isLoading } = useM1(quarryId ? { limit: '500', quarry_id: quarryId } : { limit: '500' });

  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) =>
    setF((p) => {
      const n = { ...p };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });

  const [media, setMedia] = useState<{ row: M1Row; mode: 'photo' | 'video' } | null>(null);
  const [history, setHistory] = useState<{ plate_region: string; plate_number: string } | null>(null);

  const matById = useMemo(() => {
    const m = new Map<string, Material>();
    (materials ?? []).forEach((x) => m.set(x.id, x));
    return m;
  }, [materials]);

  const rows = data?.rows ?? [];

  // Filter dropdown options derived from the full (unfiltered) result set, so
  // selecting one filter never collapses the others' choices.
  const postOpts = useMemo(
    () => [...new Set(rows.map((r) => r.post_code).filter((x): x is string => !!x))],
    [rows],
  );
  const camOpts = useMemo(
    () => [...new Set(rows.map((r) => r.camera_label).filter((x): x is string => !!x))],
    [rows],
  );
  const vtypeOpts = useMemo(() => [...new Set(rows.map((r) => r.vtype).filter(Boolean))], [rows]);

  const vtypeLabel = (v: string) => (v === 'truck' ? t('vt_truck') : v);

  // All filtering is client-side over the single fetch (mirrors the reference).
  const filtered = rows.filter((r) => {
    if (f.post && r.post_code !== f.post) return false;
    if (f.camera && r.camera_label !== f.camera) return false;
    if (f.direction && r.direction !== f.direction) return false;
    if (f.vtype && r.vtype !== f.vtype) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.load && (f.load === 'yes') !== r.is_loaded) return false;
    if (f.material_id && r.material_id !== f.material_id) return false;
    if (f.plate) {
      const hay = `${r.plate_region} ${r.plate_number}`.toUpperCase();
      if (!hay.includes(f.plate.toUpperCase())) return false;
    }
    return true;
  });

  const historyRows = useMemo(() => {
    if (!history) return [];
    return rows
      .filter((r) => r.plate_region === history.plate_region && r.plate_number === history.plate_number)
      .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  }, [rows, history]);

  const totalVol = filtered.reduce((s, r) => s + (r.volume_final || 0), 0);
  const f2 = (n: number) => formatDecimal(n, lang);
  const f1 = (n: number) => {
    const s = n.toFixed(1);
    return lang === 'ru' ? s.replace('.', ',') : s;
  };

  const year = new Date().getFullYear();

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Title + scope (skipped when embedded on the quarry detail page — that
          page already has its own title/breadcrumb) */}
      {!quarryId && (
        <div>
          <h1 style={{ fontSize: 17, margin: '0 0 4px', color: '#15273c' }}>{t('m1_title')}</h1>
          <div style={{ fontSize: 12.5, color: 'var(--muted-ink)' }}>
            {t('region')} / <b style={{ color: '#2a3f57' }}>{t('district')}</b>
          </div>
        </div>
      )}

      {/* Period (display-only) + updated stamp */}
      <Card>
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            alignItems: 'end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={lblStyle}>
              {t('as_month')}
              <select className="m1-fctrl" defaultValue="all">
                <option value="all">{t('as_all')}</option>
              </select>
            </label>
            <label style={lblStyle}>
              {t('as_year')}
              <select className="m1-fctrl" defaultValue={year}>
                <option value={year}>{year}</option>
                <option value={year - 1}>{year - 1}</option>
              </select>
            </label>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-ink)' }}>
            {t('as_updated')}: <b style={{ color: '#2a3f57' }}>—</b>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <Sel label={t('filt_post')} value={f.post} onChange={set('post')} t={t}
            opts={postOpts.map((p) => [p, p])} />
          <Sel label={t('filt_camera')} value={f.camera} onChange={set('camera')} t={t}
            opts={camOpts.map((c) => [c, c])} />
          <Sel label={t('filt_dir')} value={f.direction} onChange={set('direction')} t={t}
            opts={DIRECTIONS.map((d) => [d, t(`dir_${d}`)])} />
          <Sel label={t('filt_vtype')} value={f.vtype} onChange={set('vtype')} t={t}
            opts={vtypeOpts.map((v) => [v, vtypeLabel(v)])} />
          <Sel label={t('filt_status')} value={f.status} onChange={set('status')} t={t}
            opts={STATUSES.map((s) => [s, t(`status_${s}`)])} />
          <Sel label={t('filt_load')} value={f.load} onChange={set('load')} t={t}
            opts={LOADS.map((l) => [l, t(`load_${l === 'yes' ? 'yes' : 'no'}`)])} />
          <Sel label={t('flt_material')} value={f.material_id} onChange={set('material_id')} t={t}
            opts={(materials ?? []).map((m) => [m.id, materialName(m, lang)])} />
          <label style={lblStyle}>
            {t('filt_plate')}
            <input
              className="m1-fctrl"
              placeholder={t('filt_plate_ph')}
              value={f.plate ?? ''}
              onChange={(e) => set('plate')(e.target.value)}
            />
          </label>
          <button
            onClick={() => setF({})}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              color: 'var(--muted-ink)',
              fontWeight: 600,
            }}
          >
            {t('flt_clear')}
          </button>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <p style={{ color: 'var(--muted-ink)' }}>{t('loading')}</p>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--muted-ink)', marginBottom: 6, textAlign: 'center' }}>
              {t('scrollhint')}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="m1-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>{t('th_no')}</th>
                    <th rowSpan={2}>{t('th_post')}</th>
                    <th rowSpan={2}>{t('th_camera')}</th>
                    <th rowSpan={2}>{t('th_plate')}</th>
                    <th colSpan={5}>{t('grp_events')}</th>
                    <th rowSpan={2}>{t('th_load')}</th>
                    <th className="grp-ai" colSpan={2}>{t('grp_ai')}</th>
                    <th className="grp-mat" colSpan={1}>{t('grp_mat')}</th>
                    <th className="grp-yhxx" colSpan={2}>{t('grp_yhxx')}</th>
                  </tr>
                  <tr>
                    <th>{t('th_type')}</th>
                    <th>{t('th_dir')}</th>
                    <th>{t('th_time')}</th>
                    <th>{t('th_photo')}</th>
                    <th>{t('th_video')}</th>
                    <th className="grp-ai">{t('th_m3')}</th>
                    <th className="grp-ai">{t('th_ton')}</th>
                    <th className="grp-mat">{t('th_matname')}</th>
                    <th className="grp-yhxx">{t('th_stir')}</th>
                    <th className="grp-yhxx">{t('th_owner')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={{ textAlign: 'center', color: 'var(--muted-ink)', padding: 22 }}>
                        {t('empty_table')}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, i) => {
                      const dt = fmtDateTime(r.occurred_at);
                      const loaded = r.volume_final > 0;
                      return (
                        <tr key={r.id}>
                          <td className="ctr">{i + 1}</td>
                          <td className="ctr">{r.post_code ?? '—'}</td>
                          <td className="ctr">{r.camera_label ?? '—'}</td>
                          <td className="ctr">
                            <button
                              type="button"
                              className="m1-plate-btn"
                              title={t('veh_history_hint')}
                              onClick={() => setHistory({ plate_region: r.plate_region, plate_number: r.plate_number })}
                            >
                              <Plate row={r} />
                            </button>
                          </td>
                          <td className="ctr">{vtypeLabel(r.vtype)}</td>
                          <td className="ctr">
                            <span style={{ color: r.direction === 'exit' ? '#15835a' : '#9a6a00', fontWeight: 600 }}>
                              {t(`dir_${r.direction}`)}
                            </span>
                          </td>
                          <td className="ctr">
                            {dt.date}
                            <br />
                            <span style={{ color: 'var(--muted-ink)' }}>{dt.time}</span>
                          </td>
                          <td className="ctr">
                            <button className="m1-ic" onClick={() => setMedia({ row: r, mode: 'photo' })} title={t('th_photo')}>
                              <Glyph path={EYE} />
                            </button>
                          </td>
                          <td className="ctr">
                            <button className="m1-ic" onClick={() => setMedia({ row: r, mode: 'video' })} title={t('th_video')}>
                              <Glyph path={PLAY} />
                            </button>
                          </td>
                          <td>
                            {r.is_loaded ? (
                              <span style={{ color: '#15835a', fontWeight: 600 }}>{t('load_yes')}</span>
                            ) : (
                              <span style={{ color: 'var(--muted-ink)' }}>{t('load_no')}</span>
                            )}
                          </td>
                          <td className="num">{loaded ? f1(r.volume_final) : '-'}</td>
                          <td className="num">{r.weight_kg > 0 ? f2(r.weight_kg / 1000) : '-'}</td>
                          <td>{r.material_id ? materialName(matById.get(r.material_id), lang) : '-'}</td>
                          <td className="ctr">{r.stir || '—'}</td>
                          <td>{r.owner_name || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="ctr" colSpan={10}>
                      {t('jami')} ({filtered.length})
                    </td>
                    <td className="num">{f1(totalVol)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted-ink)' }}>
              {t('total_events')}: <b style={{ color: '#15273c' }}>{filtered.length}</b> ·{' '}
              {t('total_vol')}:{' '}
              <b style={{ color: '#15273c', fontFamily: 'var(--mono)' }}>
                {f2(totalVol)} {t('vol_unit')}
              </b>
            </div>
          </>
        )}
      </Card>

      {history && (
        <div className="m1-mwrap" onClick={() => setHistory(null)}>
          <div className="m1-mcard m1-hist-card" onClick={(e) => e.stopPropagation()}>
            <div className="m1-mhead">
              <span>
                {t('veh_history_title')} ·{' '}
                <span style={{ fontFamily: 'var(--mono)' }}>
                  {history.plate_region} {history.plate_number}
                </span>
              </span>
              <button className="m1-mx" onClick={() => setHistory(null)}>
                ✕
              </button>
            </div>
            <div style={{ padding: 14, maxHeight: '70vh', overflow: 'auto' }}>
              {historyRows.length === 0 ? (
                <p style={{ color: 'var(--muted-ink)', margin: 0 }}>{t('veh_history_empty')}</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="m1-table">
                    <thead>
                      <tr>
                        <th>{t('th_time')}</th>
                        <th>{t('th_post')}</th>
                        <th>{t('th_camera')}</th>
                        <th>{t('th_dir')}</th>
                        <th>{t('th_load')}</th>
                        <th>{t('th_m3')}</th>
                        <th>{t('th_ton')}</th>
                        <th>{t('grp_mat')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((r) => {
                        const dt = fmtDateTime(r.occurred_at);
                        const loaded = r.volume_final > 0;
                        return (
                          <tr key={r.id}>
                            <td className="ctr">
                              {dt.date}
                              <br />
                              <span style={{ color: 'var(--muted-ink)' }}>{dt.time}</span>
                            </td>
                            <td className="ctr">{r.post_code ?? '—'}</td>
                            <td className="ctr">{r.camera_label ?? '—'}</td>
                            <td className="ctr">
                              <span style={{ color: r.direction === 'exit' ? '#15835a' : '#9a6a00', fontWeight: 600 }}>
                                {t(`dir_${r.direction}`)}
                              </span>
                            </td>
                            <td className="ctr">
                              {r.is_loaded ? (
                                <span style={{ color: '#15835a', fontWeight: 600 }}>{t('load_yes')}</span>
                              ) : (
                                <span style={{ color: 'var(--muted-ink)' }}>{t('load_no')}</span>
                              )}
                            </td>
                            <td className="num">{loaded ? f1(r.volume_final) : '-'}</td>
                            <td className="num">{r.weight_kg > 0 ? f2(r.weight_kg / 1000) : '-'}</td>
                            <td>{r.material_id ? materialName(matById.get(r.material_id), lang) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted-ink)' }}>
                {t('veh_history_total')}: <b style={{ color: '#15273c' }}>{historyRows.length}</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {media && (
        <div className="m1-mwrap" onClick={() => setMedia(null)}>
          <div className="m1-mcard" onClick={(e) => e.stopPropagation()}>
            <div className="m1-mhead">
              <span>
                {media.mode === 'photo' ? t('th_photo') : t('th_video')} · {media.row.plate_region}{' '}
                {media.row.plate_number}
              </span>
              <button className="m1-mx" onClick={() => setMedia(null)}>
                ✕
              </button>
            </div>
            {media.mode === 'video' ? (
              <video
                key={media.row.id}
                poster={poster1}
                controls
                autoPlay
                muted
                loop
                playsInline
                style={{ width: '100%', display: 'block', background: '#000' }}
              >
                <source src={cam1Mp4} type="video/mp4" />
                <source src={cam1Webm} type="video/webm" />
              </video>
            ) : (
              <img src={poster1} alt="" style={{ width: '100%', display: 'block' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const lblStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  color: 'var(--muted-ink)',
};

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
    <label style={lblStyle}>
      {label}
      <select className="m1-fctrl" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
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
