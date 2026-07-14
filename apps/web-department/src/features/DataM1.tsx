import {
  type M1Row,
  type Material,
  mediaUrl,
  useM1,
  useMaterials,
  useQuarries,
} from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import { Card, cn, PlateBadge } from '@karier/ui';
import { useMemo, useState } from 'react';

const STATUSES = ['confirm', 'flagged', 'inspect', 'no_plate'] as const;
const DIRECTIONS = ['exit', 'enter'] as const;
const LOADS = ['yes', 'no'] as const;

type Lang = ReturnType<typeof currentLang>;

// Shared M-1 table cell chrome (mockup: 1px #eef2f6 grid, compact, no wrap).
const CELL = 'border border-[#eef2f6] px-3 py-2 whitespace-nowrap';
const CTR = cn(CELL, 'text-center');
const NUM = cn(CELL, 'text-right tabular-nums');
// Group tints
const AI = 'bg-[#ecfdf5]';
const MAT = 'bg-[#fff7ed]';
const OWN = 'bg-[#f1f5f9]';
// Filter controls (38px, teal focus ring)
const FCTRL =
  'h-[38px] rounded-[9px] border border-input bg-white px-[11px] text-[13px] font-[inherit] focus:border-primary focus:ring-[3px] focus:ring-primary/15 focus:outline-none';
const FLBL = 'flex flex-col gap-[5px] text-xs text-muted-foreground';
// Icon buttons (photo/video)
const ICBTN =
  'inline-grid size-7 cursor-pointer place-items-center rounded-[7px] border border-[#e2e8f0] bg-white text-primary hover:enabled:border-primary disabled:cursor-default disabled:opacity-30';

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
      width={15}
      height={15}
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
  return <PlateBadge region={row.plate_region} number={row.plate_number} />;
}

export function M1Table({ quarryId }: { quarryId?: string } = {}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { data: materials } = useMaterials();
  const { data: quarries } = useQuarries();
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

  const quarryById = useMemo(() => {
    const m = new Map<string, string>();
    (quarries ?? []).forEach((q) => m.set(q.id, q.name));
    return m;
  }, [quarries]);

  const rows = data?.rows ?? [];

  // Quarry filter options from the fetched events (only quarries with data).
  const quarryOpts = useMemo(
    () =>
      [...new Set(rows.map((r) => r.quarry_id))].map(
        (id): [string, string] => [id, quarryById.get(id) ?? id],
      ),
    [rows, quarryById],
  );

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

  const vtypeLabel = (v: string) =>
    v === 'truck' ? t('vt_truck') : v === 'car' ? t('vt_car') : v;

  // All filtering is client-side over the single fetch (mirrors the reference).
  const filtered = rows.filter((r) => {
    if (f.quarry && r.quarry_id !== f.quarry) return false;
    if (f.source && (f.source === 'zavod') !== r.is_main) return false;
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
  const totalTon = filtered.reduce((s, r) => s + (r.weight_kg || 0), 0) / 1000;
  const f2 = (n: number) => formatDecimal(n, lang);
  const f1 = (n: number) => {
    const s = n.toFixed(1);
    return lang === 'ru' ? s.replace('.', ',') : s;
  };

  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-3.5">
      {/* Title + scope (skipped when embedded on the quarry detail page — that
          page already has its own title/breadcrumb) */}
      {!quarryId && (
        <div>
          <h1 className="mb-1 text-[17px] font-semibold">{t('m1_title')}</h1>
          <div className="text-[12.5px] text-muted-foreground">
            {t('region')} / <b className="text-[#334155]">{t('district')}</b>
          </div>
        </div>
      )}

      {/* Period (display-only) + updated stamp */}
      <Card className="rounded-[14px] px-4 py-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <div className="flex flex-wrap gap-3">
            <label className={FLBL}>
              {t('as_month')}
              <select className={cn(FCTRL, 'min-w-[130px]')} defaultValue="all">
                <option value="all">{t('as_all')}</option>
              </select>
            </label>
            <label className={FLBL}>
              {t('as_year')}
              <select className={cn(FCTRL, 'min-w-[110px]')} defaultValue={year}>
                <option value={year}>{year}</option>
                <option value={year - 1}>{year - 1}</option>
              </select>
            </label>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('as_updated')}: <b className="text-[#334155]">—</b>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="rounded-[14px] px-4 py-3.5">
        <div className="flex flex-wrap items-end gap-3">
          {!quarryId && (
            <Sel label={t('q_name')} value={f.quarry} onChange={set('quarry')} t={t}
              opts={quarryOpts} />
          )}
          <Sel label={t('th_source')} value={f.source} onChange={set('source')} t={t}
            opts={[['zavod', t('grp_zavod')], ['karyer', t('grp_karyer')]]} />
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
          {!quarryId && (
            <Sel label={t('filt_load')} value={f.load} onChange={set('load')} t={t}
              opts={LOADS.map((l) => [l, t(`load_${l === 'yes' ? 'yes' : 'no'}`)])} />
          )}
          <Sel label={t('flt_material')} value={f.material_id} onChange={set('material_id')} t={t}
            opts={(materials ?? []).map((m) => [m.id, materialName(m, lang)])} />
          <label className={FLBL}>
            {t('filt_plate')}
            <input
              className={cn(FCTRL, 'min-w-[130px]')}
              placeholder={t('filt_plate_ph')}
              value={f.plate ?? ''}
              onChange={(e) => set('plate')(e.target.value)}
            />
          </label>
          <button
            onClick={() => setF({})}
            className="h-[38px] cursor-pointer rounded-[9px] border border-[#e2e8f0] bg-white px-[15px] text-[13px] font-medium text-muted-foreground"
          >
            {t('flt_clear')}
          </button>
        </div>
      </Card>

      <Card className="rounded-[14px] px-4 py-3.5">
        {isLoading ? (
          <p className="text-muted-foreground">{t('loading')}</p>
        ) : (
          <>
            <div className="mb-2 text-center text-[11.5px] text-slate-400">{t('scrollhint')}</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#f6fbfb] text-[#334155]">
                    <th rowSpan={2} className={cn(CELL, 'font-bold')}>{t('th_no')}</th>
                    {!quarryId && (
                      <th rowSpan={2} className={cn(CELL, 'font-bold')}>{t('q_name')}</th>
                    )}
                    <th rowSpan={2} className={cn(CELL, 'font-bold')}>{t('th_post')}</th>
                    <th rowSpan={2} className={cn(CELL, 'font-bold')}>{t('th_camera')}</th>
                    <th rowSpan={2} className={cn(CELL, 'font-bold')}>{t('th_source')}</th>
                    <th rowSpan={2} className={cn(CELL, 'font-bold')}>{t('th_plate')}</th>
                    <th colSpan={5} className={cn(CELL, 'font-bold')}>{t('grp_events')}</th>
                    {!quarryId && (
                      <th rowSpan={2} className={cn(CELL, 'font-bold')}>{t('th_load')}</th>
                    )}
                    <th colSpan={2} className={cn(CELL, AI, 'font-bold')}>{t('grp_ai')}</th>
                    <th colSpan={1} className={cn(CELL, MAT, 'font-bold')}>{t('grp_mat')}</th>
                    <th colSpan={2} className={cn(CELL, OWN, 'font-bold')}>{t('grp_yhxx')}</th>
                  </tr>
                  <tr className="bg-[#f6fbfb] text-[11.5px] text-[#475569]">
                    <th className={cn(CELL, 'font-semibold')}>{t('th_type')}</th>
                    <th className={cn(CELL, 'font-semibold')}>{t('th_dir')}</th>
                    <th className={cn(CELL, 'font-semibold')}>{t('th_time')}</th>
                    <th className={cn(CELL, 'font-semibold')}>{t('th_photo')}</th>
                    <th className={cn(CELL, 'font-semibold')}>{t('th_video')}</th>
                    <th className={cn(CELL, AI, 'font-semibold')}>{t('th_m3')}</th>
                    <th className={cn(CELL, AI, 'font-semibold')}>{t('th_ton')}</th>
                    <th className={cn(CELL, MAT, 'font-semibold')}>{t('th_matname')}</th>
                    <th className={cn(CELL, OWN, 'font-semibold')}>{t('th_stir')}</th>
                    <th className={cn(CELL, OWN, 'font-semibold')}>{t('th_owner')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={quarryId ? 15 : 17} className={cn(CELL, 'py-[22px] text-center text-muted-foreground')}>
                        {t('empty_table')}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, i) => {
                      const dt = fmtDateTime(r.occurred_at);
                      const loaded = r.volume_final > 0;
                      const hasPhoto = (r.image_urls?.length ?? 0) > 0;
                      const hasVideo = Boolean(r.video_url);
                      return (
                        <tr key={r.id} className="hover:bg-[#f6fefd]">
                          <td className={CTR}>{i + 1}</td>
                          {!quarryId && (
                            <td className={CTR}>{quarryById.get(r.quarry_id) ?? '—'}</td>
                          )}
                          <td className={CTR}>{r.post_code ?? '—'}</td>
                          <td className={CTR}>{r.camera_label ?? '—'}</td>
                          <td className={CTR}>
                            <span
                              className={cn(
                                'inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                r.is_main
                                  ? 'bg-[#f5f3ff] text-[#6d28d9]'
                                  : 'bg-[#eff6ff] text-[#1d4ed8]',
                              )}
                            >
                              {t(r.is_main ? 'grp_zavod' : 'grp_karyer')}
                            </span>
                          </td>
                          <td className={CTR}>
                            {r.status === 'no_plate' ? (
                              // ANPR o'qiy olmagan — operator (web-quarry) raqamni kiritadi.
                              <span className="inline-block rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1 text-[11px] font-semibold text-[#dc2626]">
                                {t('status_no_plate')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="cursor-pointer border-none bg-transparent p-0 hover:[&>span]:shadow-[0_0_0_2px_rgba(13,148,136,.35)]"
                                title={t('veh_history_hint')}
                                onClick={() => setHistory({ plate_region: r.plate_region, plate_number: r.plate_number })}
                              >
                                <Plate row={r} />
                              </button>
                            )}
                          </td>
                          <td className={CTR}>{vtypeLabel(r.vtype)}</td>
                          <td className={CTR}>
                            <span
                              className={cn(
                                'font-semibold',
                                r.direction === 'exit' ? 'text-[#059669]' : 'text-[#d97706]',
                              )}
                            >
                              {t(`dir_${r.direction}`)}
                            </span>
                          </td>
                          <td className={cn(CTR, 'text-muted-foreground')}>
                            {dt.date}
                            <br />
                            {dt.time}
                          </td>
                          <td className={CTR}>
                            <button
                              className={ICBTN}
                              disabled={!hasPhoto}
                              onClick={() => setMedia({ row: r, mode: 'photo' })}
                              title={t('th_photo')}
                            >
                              <Glyph path={EYE} />
                            </button>
                          </td>
                          <td className={CTR}>
                            <button
                              className={ICBTN}
                              disabled={!hasVideo}
                              onClick={() => setMedia({ row: r, mode: 'video' })}
                              title={t('th_video')}
                            >
                              <Glyph path={PLAY} />
                            </button>
                          </td>
                          {!quarryId && (
                            <td className={CELL}>
                              {r.is_loaded ? (
                                <span className="font-semibold text-[#059669]">{t('load_yes')}</span>
                              ) : (
                                <span className="font-semibold text-slate-400">{t('load_no')}</span>
                              )}
                            </td>
                          )}
                          <td className={NUM}>{loaded ? f1(r.volume_final) : '-'}</td>
                          <td className={NUM}>{r.weight_kg > 0 ? f2(r.weight_kg / 1000) : '-'}</td>
                          <td className={CELL}>
                            {r.material_id ? materialName(matById.get(r.material_id), lang) : '-'}
                          </td>
                          <td className={CTR}>{r.stir || '—'}</td>
                          <td className={CELL}>{r.owner_name || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#ecfdf5] font-bold">
                    <td className={cn(CTR, 'border-t-2 border-t-[#d1fae5]')} colSpan={quarryId ? 10 : 12}>
                      {t('jami')} ({filtered.length})
                    </td>
                    <td className={cn(NUM, 'border-t-2 border-t-[#d1fae5]')}>{f1(totalVol)}</td>
                    <td className={cn(NUM, 'border-t-2 border-t-[#d1fae5]')}>{f2(totalTon)}</td>
                    <td className={cn(CELL, 'border-t-2 border-t-[#d1fae5]')} colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-2.5 text-[13px] text-muted-foreground">
              {t('total_events')}: <b className="text-foreground">{filtered.length}</b> ·{' '}
              {t('total_vol')}:{' '}
              <b className="text-foreground tabular-nums">
                {f2(totalVol)} {t('vol_unit')}
              </b>{' '}
              · <b className="text-foreground tabular-nums">{f2(totalTon)} t</b>
            </div>
          </>
        )}
      </Card>

      {history && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[#070d14]/60 p-5"
          onClick={() => setHistory(null)}
        >
          <div
            className="w-full max-w-[820px] overflow-hidden rounded-[14px] bg-white shadow-[0_24px_60px_rgba(8,25,50,.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3 font-bold">
              <span>
                {t('veh_history_title')} ·{' '}
                <span className="tabular-nums">
                  {history.plate_region} {history.plate_number}
                </span>
              </span>
              <button
                className="size-[30px] cursor-pointer rounded-lg border-none bg-[#f0f3f8] text-[15px]"
                onClick={() => setHistory(null)}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-3.5">
              {historyRows.length === 0 ? (
                <p className="m-0 text-muted-foreground">{t('veh_history_empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-[#f6fbfb] text-[#334155]">
                        <th className={cn(CELL, 'font-bold')}>{t('th_time')}</th>
                        <th className={cn(CELL, 'font-bold')}>{t('th_post')}</th>
                        <th className={cn(CELL, 'font-bold')}>{t('th_camera')}</th>
                        <th className={cn(CELL, 'font-bold')}>{t('th_dir')}</th>
                        <th className={cn(CELL, 'font-bold')}>{t('th_load')}</th>
                        <th className={cn(CELL, 'font-bold')}>{t('th_m3')}</th>
                        <th className={cn(CELL, 'font-bold')}>{t('th_ton')}</th>
                        <th className={cn(CELL, 'font-bold')}>{t('grp_mat')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((r) => {
                        const dt = fmtDateTime(r.occurred_at);
                        const loaded = r.volume_final > 0;
                        return (
                          <tr key={r.id} className="hover:bg-[#f6fefd]">
                            <td className={CTR}>
                              {dt.date}
                              <br />
                              <span className="text-muted-foreground">{dt.time}</span>
                            </td>
                            <td className={CTR}>{r.post_code ?? '—'}</td>
                            <td className={CTR}>{r.camera_label ?? '—'}</td>
                            <td className={CTR}>
                              <span
                                className={cn(
                                  'font-semibold',
                                  r.direction === 'exit' ? 'text-[#059669]' : 'text-[#d97706]',
                                )}
                              >
                                {t(`dir_${r.direction}`)}
                              </span>
                            </td>
                            <td className={CTR}>
                              {r.is_loaded ? (
                                <span className="font-semibold text-[#059669]">{t('load_yes')}</span>
                              ) : (
                                <span className="font-semibold text-slate-400">{t('load_no')}</span>
                              )}
                            </td>
                            <td className={NUM}>{loaded ? f1(r.volume_final) : '-'}</td>
                            <td className={NUM}>{r.weight_kg > 0 ? f2(r.weight_kg / 1000) : '-'}</td>
                            <td className={CELL}>
                              {r.material_id ? materialName(matById.get(r.material_id), lang) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2.5 text-[13px] text-muted-foreground">
                {t('veh_history_total')}: <b className="text-foreground">{historyRows.length}</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {media && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[#070d14]/60 p-5"
          onClick={() => setMedia(null)}
        >
          <div
            className="w-full max-w-[640px] overflow-hidden rounded-[14px] bg-white shadow-[0_24px_60px_rgba(8,25,50,.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3 font-bold">
              <span>
                {media.mode === 'photo' ? t('th_photo') : t('th_video')} · {media.row.plate_region}{' '}
                {media.row.plate_number}
              </span>
              <button
                className="size-[30px] cursor-pointer rounded-lg border-none bg-[#f0f3f8] text-[15px]"
                onClick={() => setMedia(null)}
              >
                ✕
              </button>
            </div>
            {media.mode === 'video' ? (
              media.row.video_url ? (
                <video
                  key={media.row.id}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster={mediaUrl(media.row.image_urls?.[0])}
                  className="block max-h-[70vh] w-full bg-black object-contain"
                >
                  <source src={mediaUrl(media.row.video_url)} type="video/mp4" />
                </video>
              ) : (
                <p className="m-0 bg-[#f7f9fc] px-4 py-12 text-center text-muted-foreground">
                  {t('vid_no_image')}
                </p>
              )
            ) : (media.row.image_urls?.length ?? 0) > 0 ? (
              // auto-rows-max: keep photo rows content-sized so the gallery
              // scrolls instead of the grid squeezing the images into 70vh
              <div className="grid max-h-[70vh] auto-rows-max gap-1.5 overflow-auto bg-black">
                {(media.row.image_urls ?? []).map((u, idx) => (
                  <img key={idx} src={mediaUrl(u)} alt="" className="block w-full" />
                ))}
              </div>
            ) : (
              <p className="m-0 bg-[#f7f9fc] px-4 py-12 text-center text-muted-foreground">
                {t('vid_no_image')}
              </p>
            )}
          </div>
        </div>
      )}
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
    <label className={FLBL}>
      {label}
      <select
        className={cn(FCTRL, 'min-w-[120px] cursor-pointer')}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
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
