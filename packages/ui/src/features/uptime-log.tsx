/**
 * Aloqa jurnali — bitta karyer kompyuteri qachon onlayn bo'lgan va qachon,
 * nima sababdan uzilgan: "11:30 da internet o'chdi, 16:30 da qaytdi · 5 soat".
 *
 * Alohida endpoint yo'q: agent har kun uchun uzilish oraliqlarini
 * (`outages: [{from, to, min, reason}]`, UTC+5) heartbeat'da yuboradi
 * (karyer-local API.md §9). Bu yerda ular bitta vaqt chizig'iga yig'iladi:
 *   - yarim tunda kesilgan uzilish (23:10–00:00 + 00:00–02:00) bitta qatorga
 *     qo'shiladi — agent kunlarni alohida sanaydi, odam esa bitta voqea ko'radi;
 *   - uzilishlar orasidagi vaqt — "onlayn" qatorlari;
 *   - agent hozir aloqada bo'lmasa, oxirgi heartbeat'dan boshlangan ochiq
 *     qator qo'shiladi. Uning sababi (internet yoki tok) hali noma'lum —
 *     kompyuter qayta ulanganda agent aniq oraliqni yuboradi va bu qator
 *     o'zi o'sha bilan almashadi.
 */
import { type DateRangeParams, useQuarryUptime } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/utils';
import { type Tone, TONE_CHIP, TONE_DOT } from '../status';

type Kind = 'online' | 'internet' | 'server' | 'off' | 'unknown';

interface Segment {
  kind: Kind;
  start: number; // ms
  end: number | null; // null — hali davom etyapti
}

const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

const KIND_TONE: Record<Kind, Tone> = {
  online: 'success',
  internet: 'warning',
  server: 'info',
  off: 'danger',
  unknown: 'neutral',
};

const KIND_LABEL: Record<Kind, string> = {
  online: 'up_online',
  internet: 'up_net_down',
  server: 'up_server_down',
  off: 'up_agent_off',
  unknown: 'log_unknown',
};

/** "2026-11-26" + "11:30" (UTC+5) → ms. */
function uzTs(date: string, hhmm: string): number {
  return new Date(`${date}T${hhmm}:00+05:00`).getTime();
}

/** ms → UTC+5 dagi {kun, soat} — brauzer qaysi zonada bo'lishidan qat'i nazar. */
function uzParts(ts: number): { day: string; time: string } {
  const iso = new Date(ts + UZ_OFFSET_MS).toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function buildSegments(
  days: { date: string; outages: { from: string; to: string; reason: string }[] }[],
  online: boolean,
  lastSeen: string | null,
  now: number,
): Segment[] {
  const outages: Segment[] = [];
  for (const day of days) {
    for (const o of day.outages) {
      const start = uzTs(day.date, o.from);
      let end = uzTs(day.date, o.to);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      if (end <= start) end += DAY_MS; // "23:10" → "00:00" — ertasi kun yarim tuni
      const kind: Kind =
        o.reason === 'internet' || o.reason === 'server' || o.reason === 'off' ? o.reason : 'off';
      outages.push({ kind, start, end });
    }
  }
  outages.sort((a, b) => a.start - b.start);

  // Yarim tunda bo'lingan bir xil sababli uzilishlarni birlashtiramiz.
  const merged: Segment[] = [];
  for (const seg of outages) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === seg.kind && prev.end != null && seg.start - prev.end <= 60_000) {
      prev.end = Math.max(prev.end, seg.end ?? prev.end);
    } else {
      merged.push({ ...seg });
    }
  }

  const lastSeenTs = lastSeen ? new Date(lastSeen).getTime() : null;
  const out: Segment[] = [];
  merged.forEach((seg, i) => {
    out.push(seg);
    const next = merged[i + 1];
    if (next && seg.end != null && next.start > seg.end) {
      out.push({ kind: 'online', start: seg.end, end: next.start });
    }
  });

  const tail = merged[merged.length - 1];
  const tailEnd = tail?.end ?? null;
  if (online) {
    if (tailEnd != null) out.push({ kind: 'online', start: tailEnd, end: null });
  } else if (lastSeenTs != null) {
    if (tailEnd != null && lastSeenTs > tailEnd) {
      out.push({ kind: 'online', start: tailEnd, end: lastSeenTs });
    }
    if (lastSeenTs < now) out.push({ kind: 'unknown', start: lastSeenTs, end: null });
  }
  return out.reverse(); // yangidan eskiga
}

function useDuration() {
  const { t } = useTranslation();
  return (minutes: number) => {
    if (minutes <= 0) return t('up_m', { m: 0 });
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    if (d) return h ? t('up_dh', { d, h }) : t('up_d', { d });
    if (!h) return t('up_m', { m });
    return m ? t('up_hm', { h, m }) : t('up_h', { h });
  };
}

function sentenceKey(kind: Kind, ongoing: boolean): string {
  return `log_${kind}${ongoing ? '_now' : ''}`;
}

export function UptimeLog({
  quarryId,
  range,
  online,
  lastSeen,
}: {
  quarryId: string;
  range: DateRangeParams;
  online: boolean;
  lastSeen: string | null;
}) {
  const { t } = useTranslation();
  const dur = useDuration();
  const { data, isLoading } = useQuarryUptime(quarryId, range);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const segments = useMemo(
    () => buildSegments(data?.days ?? [], online, lastSeen, now),
    [data, online, lastSeen, now],
  );

  // Boshlangan kuni bo'yicha guruhlar, yangidan eskiga.
  const groups = useMemo(() => {
    const map = new Map<string, Segment[]>();
    for (const s of segments) {
      const { day } = uzParts(s.start);
      const list = map.get(day) ?? [];
      list.push(s);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [segments]);

  if (isLoading && !data) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!segments.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {data?.days.length ? t('log_clean') : t('up_empty')}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map(([day, list]) => (
        <section key={day}>
          <h3 className="m-0 mb-2 text-2xs font-semibold tracking-[0.06em] text-muted-foreground uppercase tabular-nums">
            {day.split('-').reverse().join('.')}
          </h3>
          <ol className="m-0 grid list-none gap-0 rounded-xl border bg-card p-0">
            {list.map((s) => {
              const ongoing = s.end == null;
              const end = s.end ?? now;
              const minutes = Math.max(0, Math.round((end - s.start) / 60_000));
              const from = uzParts(s.start);
              const to = uzParts(end);
              // Boshqa kunda tugagan bo'lsa, sanasi ham yoziladi.
              const toLabel =
                to.day === from.day
                  ? to.time
                  : `${to.day.slice(8, 10)}.${to.day.slice(5, 7)} ${to.time}`;
              return (
                <li
                  key={`${s.kind}-${s.start}`}
                  className="flex items-start gap-3 border-t px-4 py-3 first:border-t-0"
                >
                  <span
                    className={cn(
                      'mt-1.5 inline-block size-2 shrink-0 rounded-full',
                      s.kind === 'unknown' ? 'bg-slate-400' : TONE_DOT[KIND_TONE[s.kind]],
                      ongoing && 'animate-pulse',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {from.time} – {ongoing ? t('log_till_now') : toLabel}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-2xs font-semibold',
                          TONE_CHIP[KIND_TONE[s.kind]],
                        )}
                      >
                        {t(KIND_LABEL[s.kind])}
                      </span>
                    </div>
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                      {t(sentenceKey(s.kind, ongoing), { from: from.time, to: toLabel })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-sm tabular-nums',
                      s.kind === 'online'
                        ? 'text-muted-foreground'
                        : 'font-semibold text-foreground',
                    )}
                  >
                    {dur(minutes)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
