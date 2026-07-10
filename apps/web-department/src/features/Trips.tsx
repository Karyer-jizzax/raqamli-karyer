import {
  mediaUrl,
  type TripRecord,
  type TripStage,
  useQuarries,
  useTrips,
} from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import { Card, cn } from '@karier/ui';
import { useMemo, useState } from 'react';

const KINDS = ['karyer', 'tashqi'] as const;
const STATUSES = ['open', 'done', 'incomplete'] as const;

// Same table chrome as the M-1 grid (1px #eef2f6 grid, compact, no wrap).
const CELL = 'border border-[#eef2f6] px-3 py-2 whitespace-nowrap';
const CTR = cn(CELL, 'text-center');
const NUM = cn(CELL, 'text-right tabular-nums');
const FCTRL =
  'h-[38px] rounded-[9px] border border-input bg-white px-[11px] text-[13px] font-[inherit] focus:border-primary focus:ring-[3px] focus:ring-primary/15 focus:outline-none';
const FLBL = 'flex flex-col gap-[5px] text-xs text-muted-foreground';

const STATUS_BADGE: Record<TripRecord['status'], string> = {
  open: 'bg-[#eff6ff] text-[#1d4ed8]',
  done: 'bg-[#ecfdf5] text-[#059669]',
  incomplete: 'bg-[#fff7ed] text-[#b45309]',
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

function Stamp({ iso }: { iso: string | null }) {
  const dt = fmtDateTime(iso);
  if (!dt) return <span className="text-slate-300">—</span>;
  return (
    <span className="text-muted-foreground">
      {dt.date}
      <br />
      {dt.time}
    </span>
  );
}

function Plate({ trip }: { trip: TripRecord }) {
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-[5px] border-[1.5px] border-[#1e293b] text-[11.5px] leading-none font-bold">
      <span className="bg-[#1e293b] px-[5px] py-1 text-white">{trip.plate_region}</span>
      <span className="px-1.5 py-1 text-foreground">{trip.plate_number}</span>
      <span className="flex items-center bg-primary px-1 text-[8.5px] text-white">UZ</span>
    </span>
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

export function Trips() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5 p-6">
      <h1 className="m-0 text-[17px] font-semibold">{t('trips_title')}</h1>
      <TripsTable />
    </div>
  );
}

export function TripsTable({ quarryId }: { quarryId?: string } = {}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { data: quarries } = useQuarries();
  const { data, isLoading } = useTrips(
    quarryId ? { limit: '200', quarry_id: quarryId } : { limit: '200' },
  );

  const [f, setF] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<TripRecord | null>(null);
  const set = (k: string) => (v: string) =>
    setF((p) => {
      const n = { ...p };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });

  const quarryById = useMemo(() => {
    const m = new Map<string, string>();
    (quarries ?? []).forEach((q) => m.set(q.id, q.name));
    return m;
  }, [quarries]);

  const rows = data ?? [];

  // Client-side filtering over the single fetch (mirrors the M-1 grid).
  const filtered = rows.filter((r) => {
    if (f.quarry && r.quarry_id !== f.quarry) return false;
    if (f.kind && r.kind !== f.kind) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.plate) {
      const hay = `${r.plate_region} ${r.plate_number}`.toUpperCase();
      if (!hay.includes(f.plate.toUpperCase())) return false;
    }
    return true;
  });

  // Quarry filter options from the fetched trips (only quarries with data).
  const quarryOpts = useMemo(
    () =>
      [...new Set(rows.map((r) => r.quarry_id))].map(
        (id): [string, string] => [id, quarryById.get(id) ?? id],
      ),
    [rows, quarryById],
  );

  const totalNetto = filtered.reduce((s, r) => s + (r.netto_kg ?? 0), 0);
  const tons = (kg: number | null) => (kg == null ? '-' : formatDecimal(kg / 1000, lang));

  return (
    <div className="flex flex-col gap-3.5">
      {/* Filters */}
      <Card className="rounded-[14px] px-4 py-3.5">
        <div className="flex flex-wrap items-end gap-3">
          {!quarryId && (
            <Sel label={t('q_name')} value={f.quarry} onChange={set('quarry')} t={t}
              opts={quarryOpts} />
          )}
          <Sel label={t('trip_kind')} value={f.kind} onChange={set('kind')} t={t}
            opts={KINDS.map((k) => [k, t(`trip_kind_${k}`)])} />
          <Sel label={t('filt_status')} value={f.status} onChange={set('status')} t={t}
            opts={STATUSES.map((s) => [s, t(`trip_st_${s}`)])} />
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
                    <th className={cn(CELL, 'font-bold')}>{t('th_no')}</th>
                    {!quarryId && <th className={cn(CELL, 'font-bold')}>{t('q_name')}</th>}
                    <th className={cn(CELL, 'font-bold')}>{t('th_plate')}</th>
                    <th className={cn(CELL, 'font-bold')}>{t('trip_kind')}</th>
                    <th className={cn(CELL, 'font-bold')}>{t('th_kon_exit')}</th>
                    <th className={cn(CELL, 'font-bold')}>{t('th_main_enter')}</th>
                    <th className={cn(CELL, 'font-bold')}>{t('th_enter_w')}</th>
                    <th className={cn(CELL, 'font-bold')}>{t('th_main_exit')}</th>
                    <th className={cn(CELL, 'font-bold')}>{t('th_exit_w')}</th>
                    <th className={cn(CELL, 'font-bold bg-[#ecfdf5]')}>{t('th_netto')}</th>
                    <th className={cn(CELL, 'font-bold')}>{t('th_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={quarryId ? 10 : 11}
                        className={cn(CELL, 'py-[22px] text-center text-muted-foreground')}
                      >
                        {t('empty_table')}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, i) => (
                      <tr
                        key={r.id}
                        className="cursor-pointer hover:bg-[#f6fefd]"
                        onClick={() => setSel(r)}
                      >
                        <td className={CTR}>{i + 1}</td>
                        {!quarryId && (
                          <td className={CTR}>{quarryById.get(r.quarry_id) ?? '—'}</td>
                        )}
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
                        <td className={CTR}>
                          <Stamp iso={r.kon_exit_at} />
                        </td>
                        <td className={CTR}>
                          <Stamp iso={r.main_enter_at} />
                        </td>
                        <td className={NUM}>{tons(r.enter_weight_kg)}</td>
                        <td className={CTR}>
                          <Stamp iso={r.main_exit_at} />
                        </td>
                        <td className={NUM}>{tons(r.exit_weight_kg)}</td>
                        <td className={cn(NUM, 'bg-[#ecfdf5] font-bold')}>{tons(r.netto_kg)}</td>
                        <td className={CTR}>
                          <span
                            className={cn(
                              'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              STATUS_BADGE[r.status],
                            )}
                          >
                            {t(`trip_st_${r.status}`)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#ecfdf5] font-bold">
                    <td
                      className={cn(CTR, 'border-t-2 border-t-[#d1fae5]')}
                      colSpan={quarryId ? 8 : 9}
                    >
                      {t('jami')} ({filtered.length})
                    </td>
                    <td className={cn(NUM, 'border-t-2 border-t-[#d1fae5]')}>{tons(totalNetto)}</td>
                    <td className={cn(CELL, 'border-t-2 border-t-[#d1fae5]')} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-2.5 text-[13px] text-muted-foreground">
              {t('trips_total')}: <b className="text-foreground">{filtered.length}</b> ·{' '}
              {t('trips_total_netto')}:{' '}
              <b className="text-foreground tabular-nums">{tons(totalNetto)} t</b>
            </div>
          </>
        )}
      </Card>

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
              {sel.kon_exit || sel.main_enter || sel.main_exit ? (
                <>
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
