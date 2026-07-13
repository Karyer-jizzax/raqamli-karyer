import { mediaUrl, type TripRecord, type TripStage, useTrips } from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import { Card, cn, PlateBadge } from '@karier/ui';
import { type MouseEvent, useState } from 'react';

const KINDS = ['karyer', 'tashqi'] as const;
const STAGES = ['karyerda', 'yolda', 'zavodda', 'yakunlandi', 'yuk_emas', 'chala'] as const;
const PAGE_SIZES = [10, 25, 50] as const;

// Same table chrome as the M-1 grid (1px #eef2f6 grid, compact, no wrap).
const CELL = 'border border-[#eef2f6] px-3 py-2 whitespace-nowrap';
const CTR = cn(CELL, 'text-center');
const NUM = cn(CELL, 'text-right tabular-nums');
const TH = cn(CELL, 'font-bold');
const FCTRL =
  'h-[38px] rounded-[9px] border border-input bg-white px-[11px] text-[13px] font-[inherit] focus:border-primary focus:ring-[3px] focus:ring-primary/15 focus:outline-none';
const FLBL = 'flex flex-col gap-[5px] text-xs text-muted-foreground';

// Progress chip per derived stage: karyerda → yolda → zavodda → yakunlandi.
// chala = huquqbuzarlik (red); yuk_emas = netto below the cargo floor (gray).
const STAGE_BADGE: Record<TripRecord['stage'], string> = {
  karyerda: 'bg-[#eff6ff] text-[#1d4ed8]',
  yolda: 'bg-[#eef2ff] text-[#4338ca]',
  zavodda: 'bg-[#f5f3ff] text-[#6d28d9]',
  yakunlandi: 'bg-[#ecfdf5] text-[#059669]',
  chala: 'bg-[#fef2f2] text-[#dc2626]',
  yuk_emas: 'bg-[#f1f5f9] text-[#64748b]',
};

function fmtDateTime(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
  };
}

function Plate({ trip }: { trip: TripRecord }) {
  return <PlateBadge region={trip.plate_region} number={trip.plate_number} />;
}

// ── hover media preview ──────────────────────────────────────────────────────
interface Preview {
  stage: TripStage;
  video: boolean;
  left: number;
  top: number;
  bottom: number;
}

function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/** Photo/video chips inside a stage cell; hovering shows a floating preview. */
function MediaChips({
  stage,
  onPreview,
}: {
  stage: TripStage;
  onPreview: (p: Preview | null) => void;
}) {
  const show = (video: boolean) => (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPreview({ stage, video, left: r.left, top: r.top, bottom: r.bottom });
  };
  const CHIP =
    'inline-flex items-center gap-0.5 rounded-[6px] border border-[#e2e8f0] bg-white px-1.5 py-0.5 text-primary';
  const nImg = stage.image_urls?.length ?? 0;
  if (!nImg && !stage.video_url) return null;
  return (
    <span className="mt-1 inline-flex items-center justify-center gap-1">
      {nImg > 0 && (
        <span className={CHIP} onMouseEnter={show(false)} onMouseLeave={() => onPreview(null)}>
          <CameraIcon />
          {nImg > 1 && <span className="text-[10px] font-semibold">{nImg}</span>}
        </span>
      )}
      {stage.video_url && (
        <span className={CHIP} onMouseEnter={show(true)} onMouseLeave={() => onPreview(null)}>
          <PlayIcon />
        </span>
      )}
    </span>
  );
}

/** Floating preview card rendered next to the hovered media chip. */
function PreviewCard({ prev }: { prev: Preview }) {
  const W = 280;
  const H = 200;
  const left = Math.max(8, Math.min(prev.left - W / 2, window.innerWidth - W - 8));
  const below = prev.bottom + H + 16 < window.innerHeight;
  return (
    <div
      className="pointer-events-none fixed z-[200] overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white shadow-[0_12px_32px_rgba(8,25,50,.3)]"
      style={{ left, width: W, top: below ? prev.bottom + 8 : prev.top - H - 8 }}
    >
      {prev.video && prev.stage.video_url ? (
        <video
          src={mediaUrl(prev.stage.video_url)}
          autoPlay
          muted
          loop
          playsInline
          className="block w-full bg-black"
          style={{ height: H, objectFit: 'contain' }}
        />
      ) : (
        <img
          src={mediaUrl(prev.stage.image_urls[0])}
          alt=""
          className="block w-full bg-black"
          style={{ height: H, objectFit: 'contain' }}
        />
      )}
    </div>
  );
}

/** One checkpoint cell: time on top, weight (scale stages), then media chips. */
function StageCell({
  at,
  stage,
  weightKg,
  lang,
  onPreview,
}: {
  at: string | null;
  stage: TripStage | null;
  weightKg?: number | null;
  lang: ReturnType<typeof currentLang>;
  onPreview: (p: Preview | null) => void;
}) {
  const dt = fmtDateTime(at ?? stage?.occurred_at ?? null);
  if (!dt && !stage) {
    return (
      <td className={CTR}>
        <span className="text-slate-300">—</span>
      </td>
    );
  }
  return (
    <td className={CTR}>
      {dt && (
        <span className="text-muted-foreground">
          {dt.date}
          <br />
          <b className="text-foreground tabular-nums">{dt.time}</b>
        </span>
      )}
      {weightKg != null && (
        <div className="font-semibold text-[#0f766e] tabular-nums">
          {formatDecimal(weightKg / 1000, lang)} t
        </div>
      )}
      {stage && <MediaChips stage={stage} onPreview={onPreview} />}
    </td>
  );
}

/** One checkpoint stage inside the trip detail modal: time + video + photos. */
function StageSection({
  label,
  stage,
  t,
}: {
  label: string;
  stage: TripStage | null;
  t: (k: string) => string;
}) {
  if (!stage) return null;
  const dt = fmtDateTime(stage.occurred_at);
  return (
    <div className="border-b border-b-[#f1f5f9] py-3 last:border-b-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <b className="text-[13.5px]">{label}</b>
        {dt && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {dt.date} {dt.time}
          </span>
        )}
      </div>
      {stage.video_url && (
        <video
          key={stage.event_id}
          controls
          muted
          playsInline
          poster={mediaUrl(stage.image_urls?.[0])}
          className="mb-1.5 block max-h-[320px] w-full rounded-lg bg-black"
        >
          <source src={mediaUrl(stage.video_url)} type="video/mp4" />
        </video>
      )}
      {(stage.image_urls?.length ?? 0) > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {stage.image_urls.map((u, i) => (
            <img key={i} src={mediaUrl(u)} alt="" className="block w-full rounded-lg" />
          ))}
        </div>
      ) : !stage.video_url ? (
        <p className="m-0 text-[12.5px] text-muted-foreground">{t('vid_no_image')}</p>
      ) : null}
    </div>
  );
}

export function TripsTable({ quarryId }: { quarryId?: string } = {}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { data, isLoading } = useTrips(
    quarryId ? { limit: '200', quarry_id: quarryId } : { limit: '200' },
  );

  const [f, setF] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<TripRecord | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
  const set = (k: string) => (v: string) => {
    setPage(1);
    setF((p) => {
      const n = { ...p };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });
  };

  const rows = data ?? [];

  // Client-side filtering over the single fetch (mirrors the M-1 grid).
  const filtered = rows.filter((r) => {
    if (f.kind && r.kind !== f.kind) return false;
    if (f.stage && r.stage !== f.stage) return false;
    if (f.plate) {
      const hay = `${r.plate_region} ${r.plate_number}`.toUpperCase();
      if (!hay.includes(f.plate.toUpperCase())) return false;
    }
    return true;
  });

  // no_cargo (yuk emas) rows never count as material in the totals.
  const totalNetto = filtered.reduce(
    (s, r) => s + (r.status === 'no_cargo' ? 0 : (r.netto_kg ?? 0)),
    0,
  );
  const tons = (kg: number | null) => (kg == null ? '-' : formatDecimal(kg / 1000, lang));

  // Client-side pagination over the filtered set (filters reset to page 1).
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const pageStart = (cur - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);
  const PGBTN =
    'grid size-[30px] cursor-pointer place-items-center rounded-[8px] border border-[#e2e8f0] bg-white text-[15px] text-muted-foreground disabled:cursor-default disabled:opacity-40';

  return (
    <div className="flex flex-col gap-3.5">
      {/* Filters */}
      <Card className="rounded-[14px] px-4 py-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <Sel label={t('trip_kind')} value={f.kind} onChange={set('kind')} t={t}
            opts={KINDS.map((k) => [k, t(`trip_kind_${k}`)])} />
          <Sel label={t('filt_status')} value={f.stage} onChange={set('stage')} t={t}
            opts={STAGES.map((s) => [s, t(`stage_${s}`)])} />
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
                    <th rowSpan={2} className={TH}>{t('th_no')}</th>
                    <th rowSpan={2} className={TH}>{t('th_plate')}</th>
                    <th rowSpan={2} className={TH}>{t('trip_kind')}</th>
                    <th colSpan={2} className={TH}>{t('grp_karyer')}</th>
                    <th colSpan={2} className={TH}>{t('grp_zavod')}</th>
                    <th rowSpan={2} className={cn(TH, 'bg-[#ecfdf5]')}>{t('th_netto')}</th>
                    <th rowSpan={2} className={TH}>{t('th_status')}</th>
                  </tr>
                  <tr className="bg-[#f6fbfb] text-[#334155]">
                    <th className={cn(TH, 'font-semibold')}>{t('dir_enter')}</th>
                    <th className={cn(TH, 'font-semibold')}>{t('dir_exit')}</th>
                    <th className={cn(TH, 'font-semibold')}>{t('dir_enter')}</th>
                    <th className={cn(TH, 'font-semibold')}>{t('dir_exit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={cn(CELL, 'py-[22px] text-center text-muted-foreground')}>
                        {t('empty_table')}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r, i) => (
                      <tr
                        key={r.id}
                        className="cursor-pointer hover:bg-[#f6fefd]"
                        onClick={() => setSel(r)}
                      >
                        <td className={CTR}>{pageStart + i + 1}</td>
                        <td className={CTR}>
                          <Plate trip={r} />
                        </td>
                        <td className={CTR}>
                          <span
                            className={cn(
                              'font-semibold',
                              r.kind === 'karyer' ? 'text-[#059669]' : 'text-[#6d28d9]',
                            )}
                          >
                            {t(`trip_kind_${r.kind}`)}
                          </span>
                        </td>
                        <StageCell at={r.kon_enter_at} stage={r.kon_enter} lang={lang} onPreview={setPrev} />
                        <StageCell at={r.kon_exit_at} stage={r.kon_exit} lang={lang} onPreview={setPrev} />
                        <StageCell at={r.main_enter_at} stage={r.main_enter}
                          weightKg={r.enter_weight_kg} lang={lang} onPreview={setPrev} />
                        <StageCell at={r.main_exit_at} stage={r.main_exit}
                          weightKg={r.exit_weight_kg} lang={lang} onPreview={setPrev} />
                        <td
                          className={cn(
                            NUM,
                            'bg-[#ecfdf5] font-bold',
                            r.status === 'no_cargo' && 'bg-[#f8fafc] text-slate-400 line-through',
                          )}
                        >
                          {tons(r.netto_kg)}
                        </td>
                        <td className={CTR}>
                          <span
                            className={cn(
                              'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              STAGE_BADGE[r.stage],
                            )}
                          >
                            {t(`stage_${r.stage}`)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#ecfdf5] font-bold">
                    <td className={cn(CTR, 'border-t-2 border-t-[#d1fae5]')} colSpan={8}>
                      {t('jami')} ({filtered.length})
                    </td>
                    <td className={cn(NUM, 'border-t-2 border-t-[#d1fae5]')}>{tons(totalNetto)}</td>
                    <td className={cn(CELL, 'border-t-2 border-t-[#d1fae5]')} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[13px] text-muted-foreground">
                {t('trips_total')}: <b className="text-foreground">{filtered.length}</b> ·{' '}
                {t('trips_total_netto')}:{' '}
                <b className="text-foreground tabular-nums">{tons(totalNetto)} t</b>
              </div>
              <div className="flex items-center gap-2.5">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t('pg_per')}
                  <select
                    className={cn(FCTRL, 'h-[30px] cursor-pointer px-2 text-xs')}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {filtered.length === 0 ? 0 : pageStart + 1}–
                  {Math.min(pageStart + pageSize, filtered.length)} / {filtered.length}
                </span>
                <button className={PGBTN} disabled={cur <= 1} onClick={() => setPage(cur - 1)}>
                  ‹
                </button>
                <span className="text-[13px] text-foreground tabular-nums">
                  {cur}/{pages}
                </span>
                <button className={PGBTN} disabled={cur >= pages} onClick={() => setPage(cur + 1)}>
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Hover media preview (photo / silent looping clip). */}
      {prev && <PreviewCard prev={prev} />}

      {/* Trip detail modal: per-stage photos/video of the linked events. */}
      {sel && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[#070d14]/60 p-5"
          onClick={() => setSel(null)}
        >
          <div
            className="flex max-h-[86vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_24px_60px_rgba(8,25,50,.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 font-bold">
              <span className="flex items-center gap-2.5">
                {t('trip_detail')} <Plate trip={sel} />
              </span>
              <button
                className="size-[30px] shrink-0 cursor-pointer rounded-lg border-none bg-[#f0f3f8] text-[15px]"
                onClick={() => setSel(null)}
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-4 pb-1">
              {sel.kon_enter || sel.kon_exit || sel.main_enter || sel.main_exit ? (
                <>
                  <StageSection label={t('th_kon_enter')} stage={sel.kon_enter} t={t} />
                  <StageSection label={t('th_kon_exit')} stage={sel.kon_exit} t={t} />
                  <StageSection label={t('th_main_enter')} stage={sel.main_enter} t={t} />
                  <StageSection label={t('th_main_exit')} stage={sel.main_exit} t={t} />
                </>
              ) : (
                <p className="m-0 py-12 text-center text-muted-foreground">
                  {t('vid_no_image')}
                </p>
              )}
            </div>
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
