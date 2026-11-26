/**
 * Aloqa jurnali — bitta karyer kompyuteri qachon onlayn, qachon oflayn
 * bo'lgan: "11:30 – 16:30 · Oflayn · 5 soat", ostida kulrang kichik izoh
 * "internet yo'q edi" yoki "kompyuter o'chiq edi" (modemmi yoki tokmi —
 * texnik xodim shundan biladi).
 *
 * Alohida endpoint yo'q: agent har kun uchun uzilish oraliqlarini
 * (`outages: [{from, to, min, reason}]`, UTC+5) heartbeat'da yuboradi
 * (karyer-local API.md §9). Bu yerda ular bitta vaqt chizig'iga yig'iladi:
 *   - "server javob bermadi" oraliqlari tashlanadi — o'sha paytda karyerda
 *     internet bor edi, ya'ni karyer uchun bu onlayn vaqt (`uptime-shared`);
 *   - ketma-ket oflayn oraliqlar (yarim tunda bo'lingani yoki internet
 *     uzilib, keyin tok ketgani) bitta qatorga qo'shiladi, sabablari izohda;
 *   - oflaynlar orasidagi vaqt — onlayn qatorlari;
 *   - agent hozir aloqada bo'lmasa, oxirgi heartbeat'dan boshlangan ochiq
 *     oflayn qator qo'shiladi. Sababi hali noma'lum — kompyuter qayta
 *     ulanganda agent aniq oraliqni yuboradi va qator o'sha bilan almashadi.
 */
import { type DateRangeParams, useQuarryUptime } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/utils';
import { isOfflineOutage, type OfflineReason, REASON_NOTE, useDuration } from './uptime-shared';

interface Segment {
  online: boolean;
  start: number; // ms
  end: number | null; // null — hali davom etyapti
  /** Oflayn sabablari, vaqt tartibida; bo'sh — noma'lum (hali ulanmagan). */
  reasons: OfflineReason[];
}

const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

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
      if (!isOfflineOutage(o)) continue;
      const start = uzTs(day.date, o.from);
      let end = uzTs(day.date, o.to);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      if (end <= start) end += DAY_MS; // "23:10" → "00:00" — ertasi kun yarim tuni
      const reason: OfflineReason = o.reason === 'internet' ? 'internet' : 'off';
      outages.push({ online: false, start, end, reasons: [reason] });
    }
  }
  outages.sort((a, b) => a.start - b.start);

  // Bir-biriga tegib turgan oflayn oraliqlar — bitta voqea.
  const merged: Segment[] = [];
  for (const seg of outages) {
    const prev = merged[merged.length - 1];
    if (prev && prev.end != null && seg.start - prev.end <= 60_000) {
      prev.end = Math.max(prev.end, seg.end ?? prev.end);
      for (const r of seg.reasons) if (!prev.reasons.includes(r)) prev.reasons.push(r);
    } else {
      merged.push({ ...seg, reasons: [...seg.reasons] });
    }
  }

  const lastSeenTs = lastSeen ? new Date(lastSeen).getTime() : null;
  const out: Segment[] = [];
  merged.forEach((seg, i) => {
    out.push(seg);
    const next = merged[i + 1];
    if (next && seg.end != null && next.start > seg.end) {
      out.push({ online: true, start: seg.end, end: next.start, reasons: [] });
    }
  });

  const tailEnd = merged[merged.length - 1]?.end ?? null;
  if (online) {
    if (tailEnd != null) out.push({ online: true, start: tailEnd, end: null, reasons: [] });
  } else if (lastSeenTs != null) {
    if (tailEnd != null && lastSeenTs > tailEnd) {
      out.push({ online: true, start: tailEnd, end: lastSeenTs, reasons: [] });
    }
    if (lastSeenTs < now) out.push({ online: false, start: lastSeenTs, end: null, reasons: [] });
  }
  return out.reverse(); // yangidan eskiga
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
  const dur = useDuration(t('up_m', { m: 0 }));
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
              const note = s.online
                ? ''
                : s.reasons.length
                  ? s.reasons.map((r) => t(REASON_NOTE[r])).join(', ')
                  : t('log_reason_unknown');
              return (
                <li
                  key={`${s.online}-${s.start}`}
                  className="flex items-start gap-3 border-t px-4 py-3 first:border-t-0"
                >
                  <span
                    className={cn(
                      'mt-[7px] inline-block size-2 shrink-0 rounded-full',
                      s.online ? 'bg-success' : 'bg-danger',
                      ongoing && 'animate-pulse',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold text-foreground tabular-nums">
                        {from.time} – {ongoing ? t('log_till_now') : toLabel}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={cn('font-semibold', s.online ? 'text-success' : 'text-danger')}
                      >
                        {t(s.online ? 'ao_online' : 'ao_offline')}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-foreground tabular-nums">{dur(minutes)}</span>
                    </div>
                    {note && <p className="m-0 mt-0.5 text-xs text-slate-400">{note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
