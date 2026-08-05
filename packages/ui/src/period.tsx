/**
 * The period picker every dashboard is scoped by: one year/month pair, one
 * filter row, every card on the screen reading the same slice.
 */
import { currentLang, monthName, useTranslation } from '@karier/i18n';

import { FilterSelect } from './filters';

export interface Period {
  year: string;
  /** '' means the whole year. */
  month: string;
}

export interface DateRange {
  date_from: string;
  date_to: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Inclusive [from, to] for the picked period — the shape the stats API takes. */
export function periodRange({ year, month }: Period): DateRange {
  const y = Number(year);
  if (!month) return { date_from: `${y}-01-01`, date_to: `${y}-12-31` };
  const m = Number(month);
  return {
    date_from: iso(new Date(Date.UTC(y, m - 1, 1))),
    date_to: iso(new Date(Date.UTC(y, m, 0))),
  };
}

/** The period one step back — what a delta compares against. */
export function previousPeriod({ year, month }: Period): Period {
  const y = Number(year);
  if (!month) return { year: String(y - 1), month: '' };
  const m = Number(month);
  return m === 1 ? { year: String(y - 1), month: '12' } : { year, month: String(m - 1) };
}

/** Percent change, rounded; null when the baseline is zero (no honest ratio). */
export function deltaPct(now: number | undefined, before: number | undefined): number | null {
  if (now == null || !before) return null;
  return Math.round(((now - before) / before) * 100);
}

export function PeriodPicker({
  value,
  onChange,
  years = 3,
}: {
  value: Period;
  onChange: (p: Period) => void;
  years?: number;
}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const thisYear = new Date().getFullYear();
  return (
    <div className="flex items-end gap-2">
      <div className="w-[110px]">
        <FilterSelect
          label={t('an_year')}
          value={value.year}
          allowAll={false}
          onChange={(v) => onChange({ ...value, year: v })}
          options={Array.from({ length: years }, (_, i) => {
            const y = String(thisYear - i);
            return [y, y] as [string, string];
          })}
        />
      </div>
      <div className="w-[140px]">
        <FilterSelect
          label={t('an_month')}
          value={value.month}
          onChange={(v) => onChange({ ...value, month: v })}
          options={Array.from(
            { length: 12 },
            (_, i) => [String(i + 1), monthName(i + 1, lang)] as [string, string],
          )}
        />
      </div>
    </div>
  );
}
