/**
 * Filter panel shared by the trip and M-1 grids.
 *
 * Before: a `flex-wrap` of raw `<select>`/`<input>` at three different heights
 * with a clear button that could not tell whether anything was filtered. Now
 * every control is one height, the panel says how many filters are active, and
 * clearing is disabled when there is nothing to clear.
 */
import { useTranslation } from '@karier/i18n';
import { FilterIcon, XIcon } from 'lucide-react';
import { type ReactNode, useId } from 'react';

import { cn } from './lib/utils';
import { CountPill, Eyebrow } from './primitives';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

/** Radix Select forbids an empty-string item value, so "all" gets a sentinel. */
const ALL = '__all__';

export function FilterBar({
  activeCount,
  onClear,
  children,
  className,
}: {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      className={cn('rounded-2xl border bg-card px-4 py-3.5 shadow-card', className)}
      aria-label={t('flt_title')}
    >
      <header className="mb-2.5 flex items-center gap-2">
        <FilterIcon className="size-3.5 text-slate-400" strokeWidth={2} />
        <Eyebrow className="text-slate-400">{t('flt_title')}</Eyebrow>
        {activeCount > 0 && <CountPill>{activeCount}</CountPill>}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={activeCount === 0}
          className="ml-auto h-8 text-data font-medium text-muted-foreground disabled:opacity-40"
        >
          <XIcon />
          {t('flt_clear')}
        </Button>
      </header>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-x-3 gap-y-2.5">
        {children}
      </div>
    </section>
  );
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-[5px] text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      {children}
    </label>
  );
}

/** Dropdown filter. `value === ''` means no filter, and shows "Barchasi". */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allowAll = true,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: [value: string, label: string][];
  /** Set false where "no value" is not meaningful (e.g. a year picker). */
  allowAll?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <FieldShell label={label}>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
        <SelectTrigger id={id} className="w-full text-data" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value={ALL}>{t('flt_all')}</SelectItem>}
          {options.map(([v, lbl]) => (
            <SelectItem key={v} value={v}>
              {lbl}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

/** Free-text filter (plate search). */
export function FilterText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label}>
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="text-data md:text-data"
      />
    </FieldShell>
  );
}

/** Date filter used by the district cargo range. */
export function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="text-data md:text-data"
      />
    </FieldShell>
  );
}
