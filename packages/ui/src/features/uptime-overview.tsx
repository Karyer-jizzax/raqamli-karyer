/**
 * "Aloqa holati" — hamma karyerdagi local server (karyer-local agenti) bir
 * sahifada: hozir onlaynmi, qachondan beri shu holatda, davr davomida qancha
 * vaqt aloqada bo'lgan va qolgan vaqt nima sababdan uzilgan.
 *
 * Ikki manba bor va ular ataylab ajratib ko'rsatiladi:
 *   - hozirgi holat va "oxirgi aloqa" — server o'zi ko'rgan heartbeat;
 *   - kunlik daqiqalar va sabablar (internet / kompyuter o'chiq / server) —
 *     agent o'zi yig'ib, ulanganda yuboradigan `uptime` (karyer-local API.md §9).
 * Agent oflayn paytda statistika kelmaydi: bu kunlar u qayta ulanganda
 * to'ldiriladi. Shuning uchun oflayn karyerning "qancha vaqtdan beri" degan
 * qiymati faqat oxirgi heartbeat'dan hisoblanadi.
 *
 * Qatorni bosganda o'sha karyerning kunlik jadvali (uzilish oraliqlari bilan)
 * ochiladi — `UptimeTable` bilan bir xil, karyer sahifasidagisi.
 */
import {
  type DateRangeParams,
  type QuarryUptimeSummary,
  useUptimeSummary,
} from '@karier/api-client';
import { currentLang, formatDateTime, formatNumber, useTranslation } from '@karier/i18n';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/utils';
import { PageHeader, Tabs } from '../shell';
import { TONE_DOT } from '../status';
import { Input } from '../ui/input';
import { UptimeTable } from './uptime-table';

type Span = '1' | '7' | '30' | '90';
type StatusFilter = 'all' | 'online' | 'offline' | 'none';

const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;

/** O'zbekiston vaqtidagi kun, YYYY-MM-DD — agent kunlarni shunday sanaydi. */
function uzDay(offsetDays = 0): string {
  return new Date(Date.now() + UZ_OFFSET_MS - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function spanRange(span: Span): DateRangeParams {
  return { date_from: uzDay(Number(span) - 1), date_to: uzDay(0) };
}

/** Daqiqani "2 kun 3 soat" / "3 soat 5 daq" / "12 daq" ko'rinishiga. */
function useDuration() {
  const { t } = useTranslation();
  return (minutes: number) => {
    if (minutes <= 0) return '—';
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    if (d) return h ? t('up_dh', { d, h }) : t('up_d', { d });
    if (!h) return t('up_m', { m });
    return m ? t('up_hm', { h, m }) : t('up_h', { h });
  };
}

type State = 'online' | 'offline' | 'none';

function stateOf(q: QuarryUptimeSummary): State {
  if (!q.has_agent || !q.is_active) return 'none';
  return q.online ? 'online' : 'offline';
}

/** Hozirgi holat qachon boshlangan (ms), noma'lum bo'lsa null.
 *
 * Oflayn — oxirgi heartbeat. Onlayn — davrdagi eng so'nggi uzilishning
 * tugagan daqiqasi (agent HH:MM ni UTC+5 da yozadi); davrda uzilish bo'lmasa
 * noma'lum, ya'ni "davr davomida uzilishsiz". */
function sinceOf(q: QuarryUptimeSummary, state: State): number | null {
  if (state === 'offline') return q.last_seen_at ? new Date(q.last_seen_at).getTime() : null;
  if (state === 'online' && q.last_outage?.to) {
    const ts = new Date(`${q.last_outage.date}T${q.last_outage.to}:00+05:00`).getTime();
    return Number.isNaN(ts) || ts > Date.now() ? null : ts;
  }
  return null;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** Davrdagi har bir kun — bitta katak, rangi onlayn ulushiga qarab. */
function DayStrip({ q, range }: { q: QuarryUptimeSummary; range: DateRangeParams }) {
  const { t } = useTranslation();
  const dur = useDuration();
  const byDate = useMemo(() => new Map(q.days.map((d) => [d.date, d])), [q.days]);
  const dates = useMemo(() => {
    const out: string[] = [];
    const end = new Date(`${range.date_to}T00:00:00Z`).getTime();
    const start = new Date(`${range.date_from}T00:00:00Z`).getTime();
    for (let ts = start; ts <= end; ts += 86_400_000)
      out.push(new Date(ts).toISOString().slice(0, 10));
    return out.slice(-31); // 90 kunlik davrda ham ustun sig'sin — oxirgi oy
  }, [range.date_from, range.date_to]);

  return (
    <div className="flex flex-wrap gap-[3px]">
      {dates.map((date) => {
        const d = byDate.get(date);
        const p = d ? pct(d.online_min, d.covered_min) : null;
        const tone =
          p == null
            ? 'bg-secondary'
            : p >= 99
              ? TONE_DOT.success
              : p >= 90
                ? TONE_DOT.warning
                : TONE_DOT.danger;
        const title = d
          ? `${date.split('-').reverse().join('.')} · ${t('up_online')}: ${dur(d.online_min)} / ${dur(d.covered_min)}`
          : `${date.split('-').reverse().join('.')} · ${t('ao_no_data')}`;
        return (
          <span
            key={date}
            title={title}
            className={cn('inline-block size-[11px] rounded-[3px]', tone)}
          />
        );
      })}
    </div>
  );
}

export function UptimeOverview({ eyebrow }: { eyebrow: string }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const dur = useDuration();
  const [span, setSpan] = useState<Span>('7');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  // "Qancha vaqtdan beri" yozuvlari so'rovsiz ham yurib tursin.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => spanRange(span), [span]);
  const { data, isLoading, dataUpdatedAt } = useUptimeSummary(range);
  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const c = { online: 0, offline: 0, none: 0 };
    for (const q of rows) c[stateOf(q)] += 1;
    return c;
  }, [rows]);

  const avgPct = useMemo(() => {
    const withData = rows.filter((q) => q.totals.covered_min > 0);
    const covered = withData.reduce((s, q) => s + q.totals.covered_min, 0);
    const online = withData.reduce((s, q) => s + q.totals.online_min, 0);
    return pct(online, covered);
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // Oflaynlar tepada — sahifa "qayerda muammo bor" savoliga javob beradi.
    const order: Record<State, number> = { offline: 0, online: 1, none: 2 };
    return rows
      .filter((q) => status === 'all' || stateOf(q) === status)
      .filter((q) => !needle || q.name.toLowerCase().includes(needle))
      .sort((a, b) => order[stateOf(a)] - order[stateOf(b)] || a.name.localeCompare(b.name));
  }, [rows, status, search]);

  const fmtPct = (v: number | null) =>
    v == null ? '—' : `${formatNumber(v, lang, Number.isInteger(v) ? 0 : 1)}%`;

  const th =
    'border-b border-grid px-3 py-2.5 text-2xs font-semibold tracking-[0.06em] text-muted-foreground uppercase';

  const tiles: { key: StatusFilter; label: string; value: string; dot?: string }[] = [
    {
      key: 'online',
      label: t('ao_now_online'),
      value: String(counts.online),
      dot: TONE_DOT.success,
    },
    {
      key: 'offline',
      label: t('ao_now_offline'),
      value: String(counts.offline),
      dot: TONE_DOT.danger,
    },
    { key: 'none', label: t('ao_no_agent'), value: String(counts.none), dot: 'bg-slate-300' },
  ];

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow={eyebrow}
        title={t('ao_title')}
        subtitle={t('ao_hint')}
        meta={
          dataUpdatedAt ? (
            <span className="text-xs text-muted-foreground">
              {t('ao_updated')}:{' '}
              <b className="text-foreground tabular-nums">
                {formatDateTime(new Date(dataUpdatedAt).toISOString()).slice(11)}
              </b>
            </span>
          ) : null
        }
        actions={
          <Tabs<Span>
            value={span}
            onChange={setSpan}
            items={[
              { value: '1', label: t('ao_span_today') },
              { value: '7', label: t('ao_span_days', { n: 7 }) },
              { value: '30', label: t('ao_span_days', { n: 30 }) },
              { value: '90', label: t('ao_span_days', { n: 90 }) },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => setStatus(status === tile.key ? 'all' : tile.key)}
            className={cn(
              'cursor-pointer rounded-2xl border bg-card px-4 py-3 text-left shadow-card transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
              status === tile.key
                ? 'border-primary ring-1 ring-primary/30'
                : 'hover:bg-surface-subtle',
            )}
          >
            <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <span className={cn('inline-block size-2 rounded-full', tile.dot)} />
              {tile.label}
            </div>
            <b className="text-2xl text-foreground tabular-nums">{tile.value}</b>
          </button>
        ))}
        <div className="rounded-2xl border bg-card px-4 py-3 shadow-card">
          <div className="text-2xs text-muted-foreground">{t('ao_avg_online')}</div>
          <b className="text-2xl text-foreground tabular-nums">{fmtPct(avgPct)}</b>
        </div>
      </div>

      <section className="rounded-2xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-grid p-3">
          <div className="relative w-full max-w-[280px]">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('ao_search')}
              className="pl-8"
            />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block size-2.5 rounded-[3px]', TONE_DOT.success)} />≥ 99%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block size-2.5 rounded-[3px]', TONE_DOT.warning)} />
              90–99%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block size-2.5 rounded-[3px]', TONE_DOT.danger)} />
              &lt; 90%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[3px] bg-secondary" />
              {t('ao_no_data')}
            </span>
          </div>
        </div>

        {isLoading && !data ? (
          <p className="py-10 text-center text-data text-muted-foreground">{t('loading')}</p>
        ) : !visible.length ? (
          <p className="py-10 text-center text-data text-muted-foreground">{t('ao_empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-data">
              <thead className="bg-surface-subtle">
                <tr>
                  <th scope="col" className={cn(th, 'text-left')}>
                    {t('ao_quarry')}
                  </th>
                  <th scope="col" className={cn(th, 'text-left')}>
                    {t('ao_state')}
                  </th>
                  <th scope="col" className={cn(th, 'text-left')}>
                    {t('ao_last_seen')}
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    {t('up_online')}
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    {t('ao_offline_total')}
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    {t('up_online_pct')}
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    {t('up_outages')}
                  </th>
                  <th scope="col" className={cn(th, 'text-left')}>
                    {t('ao_days')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((q) => {
                  const state = stateOf(q);
                  const since = sinceOf(q, state);
                  const sinceMin =
                    since == null ? 0 : Math.max(0, Math.floor((now - since) / 60_000));
                  const offlineMin =
                    q.totals.net_down_min + q.totals.server_down_min + q.totals.agent_off_min;
                  const p = pct(q.totals.online_min, q.totals.covered_min);
                  const expanded = open === q.quarry_id;
                  const canOpen = q.has_agent;
                  return (
                    <Fragment key={q.quarry_id}>
                      <tr
                        className={cn(
                          'border-b border-grid last:border-b-0',
                          canOpen && 'cursor-pointer hover:bg-surface-subtle',
                          expanded && 'bg-surface-subtle',
                        )}
                        onClick={canOpen ? () => setOpen(expanded ? null : q.quarry_id) : undefined}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            {canOpen && (
                              <ChevronDownIcon
                                className={cn(
                                  'size-3.5 shrink-0 text-muted-foreground transition-transform',
                                  expanded && 'rotate-180',
                                )}
                              />
                            )}
                            {q.name}
                          </div>
                          {q.agent_version && (
                            <div className="pl-5 text-2xs text-muted-foreground">
                              v{q.agent_version}
                              {q.route === 'fallback' && ` · ${t('agent_route_fallback')}`}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-block size-2 rounded-full ring-[3px]',
                                state === 'online'
                                  ? 'bg-success ring-success/15'
                                  : state === 'offline'
                                    ? 'bg-danger ring-danger/15'
                                    : 'bg-slate-300 ring-slate-300/20',
                              )}
                            />
                            <span
                              className={cn(
                                'font-medium',
                                state === 'offline' ? 'text-danger' : 'text-foreground',
                              )}
                            >
                              {t(
                                state === 'online'
                                  ? 'ao_online'
                                  : state === 'offline'
                                    ? 'ao_offline'
                                    : q.has_agent
                                      ? 'agent_token_revoked'
                                      : 'ao_no_agent_short',
                              )}
                            </span>
                          </span>
                          {state !== 'none' && (
                            <div className="mt-0.5 pl-4 text-2xs text-muted-foreground">
                              {since == null
                                ? state === 'online'
                                  ? t('ao_no_outage_period')
                                  : '—'
                                : t(state === 'online' ? 'ao_online_for' : 'ao_offline_for', {
                                    d: dur(sinceMin) === '—' ? t('ao_just_now') : dur(sinceMin),
                                  })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-foreground tabular-nums">
                          {q.last_seen_at ? formatDateTime(q.last_seen_at) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                          {dur(q.totals.online_min)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 text-right whitespace-nowrap tabular-nums',
                            offlineMin ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {dur(offlineMin)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums',
                            p != null && p < 90 ? 'text-danger' : 'text-foreground',
                          )}
                        >
                          {fmtPct(p)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {q.totals.outages || <span className="text-muted-foreground">0</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <DayStrip q={q} range={range} />
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-grid bg-surface-subtle last:border-b-0">
                          <td colSpan={8} className="p-3">
                            <UptimeTable quarryId={q.quarry_id} range={range} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
