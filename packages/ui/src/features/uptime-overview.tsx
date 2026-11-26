/**
 * "Aloqa holati" — hamma karyerdagi local server (karyer-local agenti) bir
 * sahifada: hozir onlaynmi, qachondan beri shu holatda, davr davomida qancha
 * vaqt aloqada bo'lgan va qolgan vaqt nima sababdan uzilgan.
 *
 * Ikki manba bor:
 *   - hozirgi holat va "oxirgi aloqa" — server o'zi ko'rgan heartbeat;
 *   - kunlik daqiqalar va sabablar (internet / kompyuter o'chiq / server) —
 *     agent o'zi yig'ib, ulanganda yuboradigan `uptime` (karyer-local API.md §9).
 * Agent oflayn paytda statistika kelmaydi: o'sha kunlar u qayta ulanganda
 * to'ldiriladi. Shuning uchun oflayn karyerning "qancha vaqtdan beri" degan
 * qiymati faqat oxirgi heartbeat'dan hisoblanadi.
 *
 * Komponent sahifa ramkasini (padding, sarlavha) chizmaydi — uni ilova
 * beradi: web-main'da sarlavha Topbar'da, web-department'da `PageHeader`da.
 */
import {
  type DateRangeParams,
  type QuarryUptimeSummary,
  useUptimeSummary,
} from '@karier/api-client';
import { currentLang, formatDateTime, formatNumber, useTranslation } from '@karier/i18n';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/utils';
import { CountPill, Eyebrow } from '../primitives';
import { Tabs } from '../shell';
import { type Tone, TONE_CHIP, TONE_DOT } from '../status';
import { Input } from '../ui/input';
import { UptimeTable } from './uptime-table';

type Span = '1' | '7' | '30' | '90';
type State = 'online' | 'offline' | 'none';
type StatusFilter = 'all' | State;

const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** O'zbekiston vaqtidagi kun, YYYY-MM-DD — agent kunlarni shunday sanaydi. */
function uzDay(offsetDays = 0): string {
  return new Date(Date.now() + UZ_OFFSET_MS - offsetDays * DAY_MS).toISOString().slice(0, 10);
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

function stateOf(q: QuarryUptimeSummary): State {
  if (!q.has_agent || !q.is_active) return 'none';
  return q.online ? 'online' : 'offline';
}

const STATE_TONE: Record<State, Tone> = { online: 'success', offline: 'danger', none: 'neutral' };

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

function pctTone(p: number | null): string {
  if (p == null) return 'bg-secondary';
  return p >= 99 ? TONE_DOT.success : p >= 90 ? TONE_DOT.warning : TONE_DOT.danger;
}

type Part = 'online_min' | 'net_down_min' | 'server_down_min' | 'agent_off_min';
const PARTS: { key: Part; label: string; tone: Tone }[] = [
  { key: 'online_min', label: 'up_online', tone: 'success' },
  { key: 'net_down_min', label: 'up_net_down', tone: 'warning' },
  { key: 'server_down_min', label: 'up_server_down', tone: 'info' },
  { key: 'agent_off_min', label: 'up_agent_off', tone: 'danger' },
];

/** Davr qanday taqsimlangani — to'rt bo'lakli chiziq. */
function SplitBar({ totals }: { totals: QuarryUptimeSummary['totals'] }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
      {totals.covered_min > 0 &&
        PARTS.map((p) =>
          totals[p.key] > 0 ? (
            <span
              key={p.key}
              className={TONE_DOT[p.tone]}
              style={{ width: `${(totals[p.key] / totals.covered_min) * 100}%` }}
            />
          ) : null,
        )}
    </div>
  );
}

/** Davrdagi har bir kun — bitta katak, rangi onlayn ulushiga qarab. */
function DayStrip({ q, dates }: { q: QuarryUptimeSummary; dates: string[] }) {
  const { t } = useTranslation();
  const dur = useDuration();
  const byDate = useMemo(() => new Map(q.days.map((d) => [d.date, d])), [q.days]);
  return (
    <div className="flex flex-wrap gap-[3px]">
      {dates.map((date) => {
        const d = byDate.get(date);
        const label = date.split('-').reverse().join('.');
        return (
          <span
            key={date}
            title={
              d
                ? `${label} · ${t('up_online')}: ${dur(d.online_min)} / ${dur(d.covered_min)}`
                : `${label} · ${t('ao_no_data')}`
            }
            className={cn(
              'inline-block size-2.5 rounded-[3px]',
              pctTone(d ? pct(d.online_min, d.covered_min) : null),
            )}
          />
        );
      })}
    </div>
  );
}

function SummaryTile({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="rounded-2xl border bg-card px-[18px] py-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {dot && <span className={cn('inline-block size-2 rounded-full', dot)} />}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-[-0.01em] text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

// Ustunlar: karyer | holat | davr bo'yicha | kunlar | ochish
const ROW_GRID =
  'md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto_20px] md:items-center md:gap-5';

export function UptimeOverview({ showHint = true }: { showHint?: boolean }) {
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

  // Kun kataklari: 90 kunlik davrda ham qatorga sig'sin — oxirgi 30 kun.
  const dates = useMemo(() => {
    const out: string[] = [];
    const start = new Date(`${range.date_from}T00:00:00Z`).getTime();
    const end = new Date(`${range.date_to}T00:00:00Z`).getTime();
    for (let ts = start; ts <= end; ts += DAY_MS) out.push(new Date(ts).toISOString().slice(0, 10));
    return out.slice(-30);
  }, [range.date_from, range.date_to]);
  const showDays = span !== '1';

  const counts = useMemo(() => {
    const c: Record<State, number> = { online: 0, offline: 0, none: 0 };
    for (const q of rows) c[stateOf(q)] += 1;
    return c;
  }, [rows]);

  const avgPct = useMemo(() => {
    const covered = rows.reduce((s, q) => s + q.totals.covered_min, 0);
    const online = rows.reduce((s, q) => s + q.totals.online_min, 0);
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

  const stateLabel = (q: QuarryUptimeSummary, s: State) =>
    t(
      s === 'online'
        ? 'ao_online'
        : s === 'offline'
          ? 'ao_offline'
          : q.has_agent
            ? 'agent_token_revoked'
            : 'ao_no_agent_short',
    );

  return (
    <div className="grid gap-5">
      {/* hint + davr */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showHint ? (
          <p className="m-0 max-w-[70ch] text-sm text-muted-foreground">{t('ao_hint')}</p>
        ) : (
          <span />
        )}
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
      </div>

      {/* umumiy sonlar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile
          label={t('ao_now_online')}
          value={String(counts.online)}
          dot={TONE_DOT.success}
        />
        <SummaryTile
          label={t('ao_now_offline')}
          value={String(counts.offline)}
          dot={TONE_DOT.danger}
        />
        <SummaryTile label={t('ao_no_agent')} value={String(counts.none)} dot="bg-slate-300" />
        <SummaryTile label={t('ao_avg_online')} value={fmtPct(avgPct)} />
      </div>

      {/* ro'yxat */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <header className="flex flex-wrap items-center gap-3 border-b px-[18px] py-4">
          <div className="flex items-center gap-[9px]">
            <Eyebrow className="text-slate-400">{t('nav_quarries')}</Eyebrow>
            <CountPill>{rows.length}</CountPill>
          </div>
          <div className="ml-auto flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
            <Tabs<StatusFilter>
              value={status}
              onChange={setStatus}
              items={[
                { value: 'all', label: t('flt_all') },
                { value: 'online', label: t('ao_online') },
                { value: 'offline', label: t('ao_offline') },
                { value: 'none', label: t('ao_no_agent_short') },
              ]}
            />
            <div className="relative w-full sm:w-56">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('ao_search')}
                className="w-full pl-9"
              />
            </div>
          </div>
        </header>

        {isLoading && !data ? (
          <p className="px-[18px] py-8 text-center text-sm text-muted-foreground">{t('loading')}</p>
        ) : !visible.length ? (
          <p className="px-[18px] py-8 text-center text-sm text-muted-foreground">
            {t('ao_empty')}
          </p>
        ) : (
          <>
            {/* ustun sarlavhalari — faqat keng ekranda */}
            <div
              className={cn(
                'hidden bg-surface-subtle px-[18px] py-2.5 text-2xs font-semibold tracking-[0.06em] text-muted-foreground uppercase',
                ROW_GRID,
              )}
            >
              <span>{t('ao_quarry')}</span>
              <span>{t('ao_state')}</span>
              <span>{t('ao_period_col')}</span>
              <span className={cn(!showDays && 'invisible')}>{t('ao_days')}</span>
              <span />
            </div>

            <ul className="m-0 list-none p-0">
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
                const sinceText =
                  state === 'none'
                    ? ''
                    : since == null
                      ? state === 'online'
                        ? t('ao_no_outage_period')
                        : ''
                      : t(state === 'online' ? 'ao_online_for' : 'ao_offline_for', {
                          d: sinceMin > 0 ? dur(sinceMin) : t('ao_just_now'),
                        });

                return (
                  <li key={q.quarry_id} className="border-t first:border-t-0">
                    <button
                      type="button"
                      disabled={!canOpen}
                      onClick={() => setOpen(expanded ? null : q.quarry_id)}
                      aria-expanded={canOpen ? expanded : undefined}
                      className={cn(
                        'grid w-full gap-3 px-[18px] py-3.5 text-left transition-colors',
                        'focus-visible:bg-surface-subtle focus-visible:outline-none',
                        ROW_GRID,
                        canOpen ? 'cursor-pointer hover:bg-surface-subtle' : 'cursor-default',
                        expanded && 'bg-surface-subtle',
                      )}
                    >
                      {/* karyer */}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {q.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {q.agent_version ? `v${q.agent_version}` : '—'}
                          {q.route === 'fallback' && ` · ${t('agent_route_fallback')}`}
                        </div>
                      </div>

                      {/* holat */}
                      <div className="min-w-0">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            TONE_CHIP[STATE_TONE[state]],
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block size-1.5 rounded-full',
                              state === 'none' ? 'bg-slate-400' : TONE_DOT[STATE_TONE[state]],
                            )}
                          />
                          {stateLabel(q, state)}
                        </span>
                        {(sinceText || q.last_seen_at) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {sinceText}
                            {q.last_seen_at && (
                              <span className="block tabular-nums">
                                {t('ao_last_seen')}: {formatDateTime(q.last_seen_at)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* davr bo'yicha */}
                      <div className="min-w-0">
                        {q.totals.covered_min > 0 ? (
                          <>
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1">
                                <SplitBar totals={q.totals} />
                              </div>
                              <b
                                className={cn(
                                  'w-12 text-right text-sm tabular-nums',
                                  p != null && p < 90 ? 'text-danger' : 'text-foreground',
                                )}
                              >
                                {fmtPct(p)}
                              </b>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                              {t('ao_offline_short', { d: dur(offlineMin) })}
                              {q.totals.outages > 0 &&
                                ` · ${t('ao_outages_n', { n: q.totals.outages })}`}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('ao_no_data')}</span>
                        )}
                      </div>

                      {/* kunlar */}
                      <div className={cn('min-w-0', !showDays && 'hidden md:invisible md:block')}>
                        <DayStrip q={q} dates={dates} />
                      </div>

                      <ChevronDownIcon
                        className={cn(
                          'hidden size-4 text-muted-foreground transition-transform md:block',
                          !canOpen && 'invisible',
                          expanded && 'rotate-180',
                        )}
                      />
                    </button>

                    {expanded && (
                      <div className="border-t bg-surface-subtle px-[18px] py-4">
                        <UptimeTable quarryId={q.quarry_id} range={range} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* izoh */}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-[18px] py-3 text-xs text-muted-foreground">
          {PARTS.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block size-2 rounded-full', TONE_DOT[p.tone])} />
              {t(p.label)}
            </span>
          ))}
          {dataUpdatedAt > 0 && (
            <span className="ml-auto tabular-nums">
              {t('ao_updated')}: {formatDateTime(new Date(dataUpdatedAt).toISOString()).slice(11)}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
