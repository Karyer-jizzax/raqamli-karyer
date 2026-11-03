/**
 * Kunlik onlayn/oflayn statistikasi — karyerdagi local server qancha vaqt
 * ma'lumot uzatishga tayyor bo'lgani va qolgan vaqt nima sababdan uzilgani
 * (karyer-local API.md §9). Ma'lumot agent heartbeat'idan keladi; server
 * o'zi "internet yo'q" bilan "kompyuter o'chiq"ni ajrata olmaydi.
 */
import { type DateRangeParams, type UptimeDay, useQuarryUptime } from '@karier/api-client';
import { currentLang, formatNumber, useTranslation } from '@karier/i18n';
import { ChevronDownIcon, WifiIcon } from 'lucide-react';
import { Fragment, useState } from 'react';

import { cn } from '../lib/utils';
import { type Tone, TONE_CHIP, TONE_DOT } from '../status';

type Part = 'online_min' | 'net_down_min' | 'server_down_min' | 'agent_off_min';

const PARTS: { key: Part; label: string; tone: Tone }[] = [
  { key: 'online_min', label: 'up_online', tone: 'success' },
  { key: 'net_down_min', label: 'up_net_down', tone: 'warning' },
  { key: 'server_down_min', label: 'up_server_down', tone: 'info' },
  { key: 'agent_off_min', label: 'up_agent_off', tone: 'danger' },
];

const REASON_TONE: Record<string, Tone> = { internet: 'warning', server: 'info', off: 'danger' };
const REASON_LABEL: Record<string, string> = {
  internet: 'up_net_down',
  server: 'up_server_down',
  off: 'up_agent_off',
};

/** Daqiqani "21 s 41 daq" ko'rinishiga. */
function useDuration() {
  const { t } = useTranslation();
  return (minutes: number) => {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return t('up_m', { m });
    return m ? t('up_hm', { h, m }) : t('up_h', { h });
  };
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** To'rt bo'lakli chiziq — kun qanday taqsimlangani bir qarashda. */
function SplitBar({ day }: { day: Pick<UptimeDay, Part | 'covered_min'> }) {
  if (!day.covered_min) return <div className="h-1.5 w-full rounded-full bg-secondary" />;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      {PARTS.map((p) =>
        day[p.key] > 0 ? (
          <span
            key={p.key}
            className={TONE_DOT[p.tone]}
            style={{ width: `${(day[p.key] / day.covered_min) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function UptimeTable({ quarryId, range }: { quarryId?: string; range: DateRangeParams }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const dur = useDuration();
  const { data, isFetching } = useQuarryUptime(quarryId, range);
  const [open, setOpen] = useState<string | null>(null);

  const days = data?.days ?? [];
  const totals = data?.totals;
  const totalPct = totals ? pct(totals.online_min, totals.covered_min) : null;
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {PARTS.map((p) => (
            <span
              key={p.key}
              className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground"
            >
              <span className={cn('inline-block size-2 rounded-full', TONE_DOT[p.tone])} />
              {t(p.label)}
            </span>
          ))}
        </div>
      </header>

      {!days.length ? (
        <p className="py-10 text-center text-data text-muted-foreground">{t('up_empty')}</p>
      ) : (
        <>
          {totals && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="rounded-lg border bg-surface-subtle px-3 py-2">
                <div className="text-2xs text-muted-foreground">{t('up_online_pct')}</div>
                <b className="text-lg text-foreground tabular-nums">{fmtPct(totalPct)}</b>
              </div>
              {PARTS.map((p) => (
                <div key={p.key} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                    <span className={cn('inline-block size-2 rounded-full', TONE_DOT[p.tone])} />
                    {t(p.label)}
                  </div>
                  <b className="text-sm text-foreground tabular-nums">{dur(totals[p.key])}</b>
                </div>
              ))}
            </div>
          )}

          <div className="max-h-[420px] overflow-auto rounded-[10px] border border-grid">
            <table className="w-full min-w-[720px] border-collapse text-data">
              <thead className="sticky top-0 z-[1] bg-surface-subtle">
                <tr>
                  <th scope="col" className={cn(th, 'text-left')}>
                    {t('up_date')}
                  </th>
                  {PARTS.map((p) => (
                    <th key={p.key} scope="col" className={cn(th, 'text-right')}>
                      {t(p.label)}
                    </th>
                  ))}
                  <th scope="col" className={cn(th, 'w-[160px] text-right')}>
                    {t('up_online_pct')}
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    {t('up_outages')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const p = pct(d.online_min, d.covered_min);
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
                        {PARTS.map((part) => (
                          <td
                            key={part.key}
                            className={cn(
                              'px-2.5 py-2 text-right whitespace-nowrap tabular-nums',
                              d[part.key] ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {dur(d[part.key])}
                          </td>
                        ))}
                        <td className="px-2.5 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-[80px]">
                              <SplitBar day={d} />
                            </div>
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
                          <td colSpan={7} className="px-2.5 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {d.outages.map((o, i) => (
                                <span
                                  key={`${o.from}-${i}`}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-2xs tabular-nums',
                                    TONE_CHIP[REASON_TONE[o.reason] ?? 'neutral'],
                                  )}
                                >
                                  {o.from}–{o.to}
                                  <span className="opacity-80">
                                    · {dur(o.min)} · {t(REASON_LABEL[o.reason] ?? o.reason)}
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
