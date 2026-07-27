/**
 * App chrome shared by web-department and web-quarry: the brand header, the
 * top nav, the per-page header with its breadcrumb trail, and the tab control.
 *
 * Nothing here imports react-router — navigation arrives as callbacks so the
 * package stays router-free.
 */
import { useTranslation } from '@karier/i18n';
import { ChevronRightIcon, HomeIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { LangSwitcher } from './components';
import { cn } from './lib/utils';
import { Eyebrow } from './primitives';

/** Brand lockup + language switcher + profile menu. Identical in both apps. */
export function AppHeader({ title, children }: { title: string; children?: ReactNode }) {
  // "Karier Kontrol — Departament" → render the suffix (from the dash) muted.
  const [brand, suffix] = title.split(' — ');
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-[26px]">
      <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary text-[15px] font-bold text-primary-foreground">
        K
      </div>
      <strong className="truncate text-base font-semibold tracking-[-0.01em]">
        {brand}
        {suffix && <span className="font-medium text-slate-400"> — {suffix}</span>}
      </strong>
      <div className="ml-auto flex items-center gap-3.5">
        <LangSwitcher />
        {children}
      </div>
    </header>
  );
}

/** Underlined top nav. Apps supply their own router links styled with `navLink`. */
export function TopNav({ children }: { children: ReactNode }) {
  return (
    <nav className="flex gap-[26px] overflow-x-auto border-b bg-card px-4 lg:px-[26px]">
      {children}
    </nav>
  );
}

export function navLink(active: boolean) {
  return cn(
    'border-b-[3px] px-0.5 py-3.5 text-sm whitespace-nowrap no-underline transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
    active
      ? 'border-primary font-semibold text-primary'
      : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
  );
}

export interface Crumb {
  label: string;
  onClick?: () => void;
}

/**
 * Drill-down trail: ⌂ › Jizzax › Zomin › Karyer. The home button is the way
 * back to the map, and every crumb but the last is clickable.
 */
export function Breadcrumb({ items, onHome }: { items: Crumb[]; onHome?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav_breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-xs">
      {onHome && (
        <button
          type="button"
          onClick={onHome}
          title={t('dash_back')}
          aria-label={t('dash_back')}
          className={cn(
            'grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border bg-card text-primary',
            'transition-colors hover:bg-primary-tint active:scale-[0.97]',
            'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
          )}
        >
          <HomeIcon className="size-4" strokeWidth={1.8} />
        </button>
      )}
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {(i > 0 || onHome) && (
              <ChevronRightIcon className="size-3.5 shrink-0 text-slate-300" strokeWidth={2} />
            )}
            {last || !c.onClick ? (
              <span
                className={cn('truncate', last ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                aria-current={last ? 'page' : undefined}
              >
                {c.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={c.onClick}
                className="cursor-pointer truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                {c.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * One page header for every screen: what section you are in, what you are
 * looking at, how you got here, and how fresh the numbers are.
 */
export function PageHeader({
  eyebrow,
  title,
  breadcrumb,
  meta,
  actions,
}: {
  eyebrow: string;
  title: string;
  breadcrumb?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <Eyebrow className="text-slate-400">{eyebrow}</Eyebrow>
        <h1 className="mt-0.5 mb-1.5 truncate text-lg font-semibold tracking-[-0.01em]">{title}</h1>
        {breadcrumb}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {meta}
        {actions}
      </div>
    </header>
  );
}

/** "Yangilandi: 12:04" stamp shown next to a page title. */
export function UpdatedStamp({ at }: { at: string }) {
  const { t } = useTranslation();
  return (
    <span className="text-xs text-muted-foreground">
      {t('as_updated')}: <b className="text-foreground tabular-nums">{at}</b>
    </span>
  );
}

/**
 * Segmented tabs, in the same visual language as LangSwitcher. No transition on
 * the active pill: an operator flips between "Ma'lumotlar" and "Hodisalar" all
 * day, and motion on a hundred-times-a-day control just reads as lag.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('inline-flex gap-0.5 rounded-[10px] bg-secondary p-[3px]', className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const i = items.findIndex((x) => x.value === value);
              const next = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
              if (next) onChange(next.value);
            }}
            className={cn(
              'cursor-pointer rounded-[8px] px-3.5 py-1.5 text-data font-semibold',
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
