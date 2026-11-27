/**
 * Kunlik onlayn/oflayn statistikasi — karyerdagi local server har kuni
 * qancha vaqt onlayn va qancha vaqt oflayn bo'lgani (karyer-local API.md §9).
 *
 * Faqat ikki holat (qoidalari `uptime-shared.tsx`da): "server javob
 * bermadi" onlaynga qo'shiladi, internet yo'qligi va kompyuter o'chiqligi —
 * oflayn. Oflayn sababi kichik kulrang izohda: texnik xodimga kerak, lekin
 * ko'zga tashlanib turmasligi kerak.
 */
import { type DateRangeParams, useQuarryUptime } from '@karier/api-client';
import { currentLang, formatNumber, useTranslation } from '@karier/i18n';
import { ChevronDownIcon, WifiIcon } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

import { cn } from '../lib/utils';
import {
  isOfflineOutage,
  offlineMin,
  OnlineBar,
  onlineMin,
  onlinePct,
  REASON_NOTE,
  type UptimeMinutes,
  useDuration,
} from './uptime-shared';

/** Oflayn vaqt sabablari bo'yicha: "internet yo'q edi 1 soat · kompyuter o'chiq edi 20 daq". */
function useReasonNote() {
  const { t } = useTranslation();
  const dur = useDuration();
  return (d: UptimeMinutes) =>
    [
      d.net_down_min > 0 && `${t(REASON_NOTE.internet)} ${dur(d.net_down_min)}`,
      d.agent_off_min > 0 && `${t(REASON_NOTE.off)} ${dur(d.agent_off_min)}`,
      (d.pending_min ?? 0) > 0 && t('log_reason_unknown'),
    ]
      .filter(Boolean)
      .join(' · ');
}

export function UptimeTable({ quarryId, range }: { quarryId?: string; range: DateRangeParams }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const dur = useDuration();
  const reasonNote = useReasonNote();
  const { data, isFetching } = useQuarryUptime(quarryId, range);
  const [open, setOpen] = useState<string | null>(null);

  // "server" oraliqlari karyer uzilishi emas — ro'yxatdan ham, sonidan ham chiqadi.
  const days = useMemo(
    () => (data?.days ?? []).map((d) => ({ ...d, outages: d.outages.filter(isOfflineOutage) })),
    [data],
  );
  const totals = data?.totals;
  const outageTotal = days.reduce((s, d) => s + d.outages.length, 0);
  const fmtPct = (v: number | null) =>
    v == null ? '—' : `${formatNumber(v, lang, Number.isInteger(v) ? 0 : 1)}%`;

  const th =
    'border-b border-grid px-2.5 py-2 text-2xs font-semibold tracking-[0.06em] text-muted-foreground uppercase';

  return (
    <section
      className={cn(
        'rounded-2xl border bg-card p-5 shadow-card transition-opacity',
        isFetching && !data && 'opacity-60',
      )}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="m-0 flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground">
            <WifiIcon className="size-4 text-primary" strokeWidth={1.8} />
            {t('up_title')}
          </h2>
          <p className="m-0 mt-0.5 text-2xs text-muted-foreground">{t('up_hint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-success" />
            {t('ao_online')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-danger" />
            {t('ao_offline')}
          </span>
        </div>
      </header>

      {!days.length ? (
        <p className="py-10 text-center text-data text-muted-foreground">{t('up_empty')}</p>
      ) : (
        <>
          {totals && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border px-3 py-2">
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="inline-block size-2 rounded-full bg-success" />
                  {t('ao_online')}
                </div>
                <b className="text-sm text-foreground tabular-nums">{dur(onlineMin(totals))}</b>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="inline-block size-2 rounded-full bg-danger" />
                  {t('ao_offline')}
                </div>
                <b className="text-sm text-foreground tabular-nums">{dur(offlineMin(totals))}</b>
                {offlineMin(totals) > 0 && (
                  <div className="text-2xs text-slate-400">{reasonNote(totals)}</div>
                )}
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-2xs text-muted-foreground">{t('up_outages')}</div>
                <b className="text-sm text-foreground tabular-nums">{outageTotal}</b>
              </div>
            </div>
          )}

          <div className="max-h-[420px] overflow-auto rounded-[10px] border border-grid">
            <table className="w-full min-w-[600px] border-collapse text-data">
              <thead className="sticky top-0 z-[1] bg-surface-subtle">
                <tr>
                  <th scope="col" className={cn(th, 'text-left')}>
                    {t('up_date')}
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    {t('ao_online')}
                  </th>
                  <th scope="col" className={cn(th, 'text-left')}>
                    {t('ao_offline')}
                  </th>
                  <th scope="col" className={cn(th, 'w-[170px] text-right')}>
                    {t('up_online_pct')}
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    {t('up_outages')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const p = onlinePct(d);
                  const off = offlineMin(d);
                  const expanded = open === d.date;
                  const hasOutages = d.outages.length > 0;
                  return (
                    <Fragment key={d.date}>
                      <tr
                        className={cn(
                          'border-b border-grid last:border-b-0',
                          hasOutages && 'cursor-pointer hover:bg-surface-subtle',
                        )}
                        onClick={hasOutages ? () => setOpen(expanded ? null : d.date) : undefined}
                      >
                        <td className="px-2.5 py-2 whitespace-nowrap text-foreground tabular-nums">
                          {d.date.split('-').reverse().join('.')}
                        </td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap text-foreground tabular-nums">
                          {dur(onlineMin(d))}
                        </td>
                        <td className="px-2.5 py-2 tabular-nums">
                          <span className={off ? 'text-foreground' : 'text-muted-foreground'}>
                            {dur(off)}
                          </span>
                          {off > 0 && (
                            <div className="text-2xs text-slate-400">{reasonNote(d)}</div>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <OnlineBar d={d} className="w-[90px]" />
                            <b
                              className={cn(
                                'w-[48px] text-right tabular-nums',
                                p != null && p < 90 ? 'text-danger' : 'text-foreground',
                              )}
                            >
                              {fmtPct(p)}
                            </b>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap text-foreground tabular-nums">
                          {hasOutages ? (
                            <span className="inline-flex items-center gap-1">
                              {d.outages.length}
                              <ChevronDownIcon
                                className={cn(
                                  'size-3.5 text-muted-foreground transition-transform',
                                  expanded && 'rotate-180',
                                )}
                              />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-grid bg-surface-subtle last:border-b-0">
                          <td colSpan={5} className="px-2.5 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {d.outages.map((o, i) => (
                                <span
                                  key={`${o.from}-${i}`}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-danger-tint px-2 py-0.5 text-2xs text-danger tabular-nums"
                                >
                                  {o.from}–{o.to} · {dur(o.min)}
                                  <span className="text-slate-400">
                                    {t(REASON_NOTE[o.reason === 'internet' ? 'internet' : 'off'])}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
