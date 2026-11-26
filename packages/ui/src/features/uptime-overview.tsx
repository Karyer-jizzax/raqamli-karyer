/**
 * "Aloqa holati" — hamma karyerdagi local server (karyer-local agenti) bir
 * sahifada: hozir onlaynmi yoki oflaynmi, qachondan beri, davr davomida
 * qancha vaqt onlayn bo'lgan.
 *
 * Ekranda faqat ikki holat: yashil **Onlayn**, qizil **Oflayn** (qoidalari
 * `uptime-shared.tsx`da). Oflayn sababi — internet yo'qmi, kompyuter
 * o'chiqmi, agent umuman ulanmaganmi — kichik kulrang izoh: texnik xodimga
 * kerak, lekin ko'zga tashlanib turmasligi kerak.
 *
 * Ikki manba bor:
 *   - hozirgi holat va "oxirgi aloqa" — server o'zi ko'rgan heartbeat;
 *   - kunlik daqiqalar va sabablar — agent o'zi yig'ib, ulanganda
 *     yuboradigan `uptime` (karyer-local API.md §9). Agent oflayn paytda
 *     statistika kelmaydi: o'sha kunlar u qayta ulanganda to'ldiriladi.
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
import { Input } from '../ui/input';
import { UptimeLog } from './uptime-log';
import { offlineMin, OnlineBar, onlineMin, onlinePct, useDuration } from './uptime-shared';
import { UptimeTable } from './uptime-table';

type Span = '1' | '7' | '30' | 'custom';
type State = 'online' | 'offline';
type Detail = 'log' | 'daily';

const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
/** Backend bir so'rovda ko'pi bilan 92 kun beradi (`/agents/uptime`). */
const MAX_DAYS = 92;

/** O'zbekiston vaqtidagi kun, YYYY-MM-DD — agent kunlarni shunday sanaydi. */
function uzDay(offsetDays = 0): string {
  return new Date(Date.now() + UZ_OFFSET_MS - offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function shiftDay(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Tanlangan davr; qo'lda tanlanganda tartibi to'g'rilanadi va 92 kunga qisqartiriladi. */
function spanRange(span: Span, custom: DateRangeParams): DateRangeParams {
  if (span !== 'custom') return { date_from: uzDay(Number(span) - 1), date_to: uzDay(0) };
  let { date_from: from, date_to: to } = custom;
  if (!from || !to) return { date_from: uzDay(6), date_to: uzDay(0) };
  if (from > to) [from, to] = [to, from];
  const minFrom = shiftDay(to, -(MAX_DAYS - 1));
  return { date_from: from < minFrom ? minFrom : from, date_to: to };
}

/** Ixcham davr tugmalari — qidiruv maydoni bilan bir balandlikda (h-9). */
function SpanSwitch({
  value,
  onChange,
  items,
}: {
  value: Span;
  onChange: (v: Span) => void;
  items: { value: Span; label: string }[];
}) {
  return (
    <div role="tablist" className="inline-flex h-9 gap-0.5 rounded-[10px] bg-secondary p-[3px]">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'cursor-pointer rounded-[8px] px-2.5 text-xs font-semibold whitespace-nowrap',
              'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
              active
                ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(15_23_42_/_0.08)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Agent ulanmagan yoki tokeni bekor qilingan karyer — ham oflayn. */
const hasLiveAgent = (q: QuarryUptimeSummary) => q.has_agent && q.is_active;

function stateOf(q: QuarryUptimeSummary): State {
  return hasLiveAgent(q) && q.online ? 'online' : 'offline';
}

/** Hozirgi holat qachon boshlangan (ms), noma'lum bo'lsa null.
 *
 * Oflayn — oxirgi heartbeat. Onlayn — davrdagi eng so'nggi uzilishning
 * tugagan daqiqasi (agent HH:MM ni UTC+5 da yozadi); davrda uzilish bo'lmasa
 * noma'lum, ya'ni "davr davomida uzilishsiz". */
function sinceOf(q: QuarryUptimeSummary, state: State): number | null {
  if (!hasLiveAgent(q)) return null;
  if (state === 'offline') return q.last_seen_at ? new Date(q.last_seen_at).getTime() : null;
  if (q.last_outage?.to) {
    const ts = new Date(`${q.last_outage.date}T${q.last_outage.to}:00+05:00`).getTime();
    return Number.isNaN(ts) || ts > Date.now() ? null : ts;
  }
  return null;
}

/** Kun katagi rangi — onlayn ulushiga qarab. */
function pctTone(p: number | null): string {
  if (p == null) return 'bg-secondary';
  return p >= 99 ? 'bg-success' : p >= 90 ? 'bg-success/50' : 'bg-danger';
}

/** Davrdagi har bir kun — bitta katak. */
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
                ? `${label} · ${t('ao_online')}: ${dur(onlineMin(d))} · ${t('ao_offline')}: ${dur(offlineMin(d))}`
                : `${label} · ${t('ao_no_data')}`
            }
            className={cn('inline-block size-2.5 rounded-[3px]', pctTone(d ? onlinePct(d) : null))}
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

export function UptimeOverview() {
  const { t } = useTranslation();
  const lang = currentLang();
  const dur = useDuration();
  const [span, setSpan] = useState<Span>('7');
  const [custom, setCustom] = useState<DateRangeParams>(() => ({
    date_from: uzDay(6),
    date_to: uzDay(0),
  }));
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>('log');
  // "Qancha vaqtdan beri" yozuvlari so'rovsiz ham yurib tursin.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => spanRange(span, custom), [span, custom]);
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
  const showDays = dates.length > 1;

  const counts = useMemo(() => {
    const c: Record<State, number> = { online: 0, offline: 0 };
    for (const q of rows) c[stateOf(q)] += 1;
    return c;
  }, [rows]);

  const avgPct = useMemo(() => {
    const sum = {
      covered_min: 0,
      online_min: 0,
      net_down_min: 0,
      server_down_min: 0,
      agent_off_min: 0,
    };
    for (const q of rows) {
      sum.covered_min += q.totals.covered_min;
      sum.online_min += q.totals.online_min;
      sum.server_down_min += q.totals.server_down_min;
    }
    return onlinePct(sum);
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // Oflaynlar tepada — sahifa "qayerda muammo bor" savoliga javob beradi;
    // agenti umuman ulanmaganlar esa oxirida (bu doimiy holat, yangilik emas).
    const rank = (q: QuarryUptimeSummary) =>
      stateOf(q) === 'online' ? 1 : hasLiveAgent(q) ? 0 : 2;
    return rows
      .filter((q) => !needle || q.name.toLowerCase().includes(needle))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [rows, search]);

  const fmtPct = (v: number | null) =>
    v == null ? '—' : `${formatNumber(v, lang, Number.isInteger(v) ? 0 : 1)}%`;

  return (
    <div className="grid gap-5">
      {/* umumiy sonlar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummaryTile label={t('ao_now_online')} value={String(counts.online)} dot="bg-success" />
        <SummaryTile label={t('ao_now_offline')} value={String(counts.offline)} dot="bg-danger" />
        <SummaryTile label={t('ao_avg_online')} value={fmtPct(avgPct)} />
      </div>

      {/* ro'yxat */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <header className="flex flex-wrap items-center gap-3 border-b px-[18px] py-4">
          <div className="flex items-center gap-[9px]">
            <Eyebrow className="text-slate-400">{t('nav_quarries')}</Eyebrow>
            <CountPill>{rows.length}</CountPill>
          </div>
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <SpanSwitch
              value={span}
              onChange={setSpan}
              items={[
                { value: '1', label: t('ao_span_today') },
                { value: '7', label: t('ao_span_days', { n: 7 }) },
                { value: '30', label: t('ao_span_days', { n: 30 }) },
                { value: 'custom', label: t('ao_span_custom') },
              ]}
            />
            {span === 'custom' && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={custom.date_from}
                  max={custom.date_to || uzDay(0)}
                  onChange={(e) => setCustom((c) => ({ ...c, date_from: e.target.value }))}
                  aria-label={t('ao_date_from')}
                  className="h-9 w-[136px] px-2.5 text-xs md:text-xs"
                />
                <span className="text-xs text-slate-400">–</span>
                <Input
                  type="date"
                  value={custom.date_to}
                  min={custom.date_from}
                  max={uzDay(0)}
                  onChange={(e) => setCustom((c) => ({ ...c, date_to: e.target.value }))}
                  aria-label={t('ao_date_to')}
                  className="h-9 w-[136px] px-2.5 text-xs md:text-xs"
                />
              </div>
            )}
            <div className="relative w-full sm:w-48">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('ao_search')}
                className="h-9 w-full pl-9"
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
                const live = hasLiveAgent(q);
                const since = sinceOf(q, state);
                const sinceMin =
                  since == null ? 0 : Math.max(0, Math.floor((now - since) / 60_000));
                const p = onlinePct(q.totals);
                const expanded = open === q.quarry_id;
                const canOpen = q.has_agent;

                // Holat ostidagi kulrang izoh.
                const note = !q.has_agent
                  ? t('ao_note_no_agent')
                  : !q.is_active
                    ? t('agent_token_revoked')
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
                        {q.agent_version && (
                          <div className="truncate text-xs text-muted-foreground">
                            v{q.agent_version}
                            {q.route === 'fallback' && ` · ${t('agent_route_fallback')}`}
                          </div>
                        )}
                      </div>

                      {/* holat */}
                      <div className="min-w-0">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            state === 'online'
                              ? 'bg-success-tint text-success'
                              : 'bg-danger-tint text-danger',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block size-1.5 rounded-full',
                              state === 'online' ? 'bg-success' : 'bg-danger',
                            )}
                          />
                          {t(state === 'online' ? 'ao_online' : 'ao_offline')}
                        </span>
                        {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
                        {live && q.last_seen_at && (
                          <div className="text-xs text-slate-400 tabular-nums">
                            {t('ao_last_seen')}: {formatDateTime(q.last_seen_at)}
                          </div>
                        )}
                      </div>

                      {/* davr bo'yicha */}
                      <div className="min-w-0">
                        {q.totals.covered_min > 0 ? (
                          <>
                            <div className="flex items-center gap-2.5">
                              <OnlineBar d={q.totals} className="flex-1" />
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
                              {t('ao_online')}: {dur(onlineMin(q.totals))} · {t('ao_offline')}:{' '}
                              {dur(offlineMin(q.totals))}
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
                      <div className="grid gap-3 border-t bg-surface-subtle px-[18px] py-4">
                        <Tabs<Detail>
                          value={detail}
                          onChange={setDetail}
                          items={[
                            { value: 'log', label: t('log_tab') },
                            { value: 'daily', label: t('log_tab_daily') },
                          ]}
                        />
                        {detail === 'log' ? (
                          <UptimeLog
                            quarryId={q.quarry_id}
                            range={range}
                            online={state === 'online'}
                            lastSeen={live ? q.last_seen_at : null}
                          />
                        ) : (
                          <UptimeTable quarryId={q.quarry_id} range={range} />
                        )}
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
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-success" />
            {t('ao_online')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-danger" />
            {t('ao_offline')}
          </span>
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
