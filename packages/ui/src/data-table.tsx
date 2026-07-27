/**
 * Chrome for the dense M-1 / trip grids.
 *
 * The ruled "spreadsheet" look is deliberate — these tables mirror the paper
 * M-1 form an inspector signs — but the ruling, the header tint and the row
 * hover now come from tokens instead of a hex per file. The grid scrolls inside
 * itself so the page never scrolls sideways, and the header stays put while it
 * does.
 */
import { useTranslation } from '@karier/i18n';
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  RotateCcwIcon,
} from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn } from './lib/utils';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// ── cell chrome ──────────────────────────────────────────────────────────────
export const GRID_CELL = 'border border-grid px-3 py-2 whitespace-nowrap';
export const GRID_CTR = cn(GRID_CELL, 'text-center');
export const GRID_NUM = cn(GRID_CELL, 'text-right tabular-nums');

/** Header cells keep a fixed 36px height so the second row can stick under the
 *  first one at a known offset (`GRID_TH_SUB`). */
export const GRID_TH = cn(
  'sticky top-0 z-20 h-9 border border-grid bg-surface-subtle px-3',
  'text-2xs font-semibold tracking-[0.06em] whitespace-nowrap text-slate-600 uppercase',
);
export const GRID_TH_SUB = cn(
  'sticky top-9 z-20 h-9 border border-grid bg-surface-subtle px-3',
  'text-2xs font-medium tracking-[0.06em] whitespace-nowrap text-slate-500 uppercase',
);

/** Row hover tinted with the app accent; the whole row is one click target. */
export const GRID_ROW = 'hover:bg-surface-hover';

/** Unit suffix (`t`, `m³`) — smaller and quieter than the number it follows. */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-0.5 text-2xs font-medium text-muted-foreground">{children}</span>;
}

// ── scroll container ─────────────────────────────────────────────────────────

/** Fades the left/right edge only while there is more table in that direction. */
function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, edges, onScroll: measure };
}

/** Never shrink below this — a grid worth two rows is worse than a page scroll. */
const MIN_GRID_HEIGHT = 320;

/**
 * Grow the grid to the bottom of the viewport.
 *
 * A fixed `calc(100vh - Xrem)` cannot know how much chrome sits above it — the
 * page header, the filter panel and the app nav all vary — so on a laptop
 * screen it left room for two rows. Measure the real distance from the top of
 * the document to this element instead, and take everything below it.
 * `reserve` is the space the caller needs *under* the grid (pagination, totals).
 */
function useFillViewport(reserve: number, enabled: boolean) {
  const [maxHeight, setMaxHeight] = useState<number>();
  const ref = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    // Document-relative top, so scrolling the page does not resize the grid.
    const top = el.getBoundingClientRect().top + window.scrollY;
    setMaxHeight(Math.max(MIN_GRID_HEIGHT, window.innerHeight - top - reserve));
  }, [reserve, enabled]);

  // No dep array: anything that re-renders this grid (collapsing the filter
  // panel, a page size change) may have moved it, so re-measure. React bails
  // out when the value is unchanged, so this settles in one pass.
  useLayoutEffect(measure);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return { ref, maxHeight };
}

/**
 * Scroll shell: horizontal scrolling is contained here, and the sticky header
 * needs this element to be the scroll parent. By default the grid fills the
 * viewport; pass `maxHeight` to pin it (a dialog, where the viewport is not
 * the constraint).
 */
export function DataTable({
  children,
  className,
  maxHeight,
  reserve = 96,
}: {
  children: ReactNode;
  className?: string;
  /** Tailwind class that pins the height instead of filling the viewport. */
  maxHeight?: string;
  /** Pixels needed below the grid (pagination, totals row). */
  reserve?: number;
}) {
  const { ref: scrollRef, edges, onScroll } = useScrollEdges();
  const { ref: fillRef, maxHeight: fillHeight } = useFillViewport(reserve, !maxHeight);
  return (
    <div className="relative" ref={fillRef}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={maxHeight ? undefined : { maxHeight: fillHeight }}
        className={cn('overflow-auto rounded-[10px] border border-grid', maxHeight, className)}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-[10px]',
          'bg-gradient-to-r from-slate-900/8 to-transparent',
          'transition-opacity duration-150 ease-out',
          edges.left ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-[10px]',
          'bg-gradient-to-l from-slate-900/8 to-transparent',
          'transition-opacity duration-150 ease-out',
          edges.right ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

/** `<table>` with the shared type size — always used inside `DataTable`. */
export function DataGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cn('w-full border-collapse text-data', className)}>{children}</table>
  );
}

// ── loading / empty / error ──────────────────────────────────────────────────

/** Table-shaped loading state: shimmer rows, not the word "loading". */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-grid" aria-busy>
      <div className="h-9 border-b border-grid bg-surface-subtle" />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3 border-b border-grid px-3 py-2.5 last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              className="h-3.5 flex-1 animate-pulse rounded bg-secondary"
              // Stagger so the row reads as one object settling, not 6 blinks.
              style={{ animationDelay: `${(r * cols + c) * 18}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state. `filtered` distinguishes "your filters excluded everything"
 * (offer to clear them) from "nothing has been recorded yet".
 */
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-2 rounded-[10px] border border-dashed border-grid px-6 py-14 text-center">
      <span className="text-slate-300">{icon ?? <InboxIcon className="size-7" strokeWidth={1.5} />}</span>
      <p className="m-0 text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="m-0 max-w-[46ch] text-data text-muted-foreground">{hint}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

// ── pagination ───────────────────────────────────────────────────────────────

/** Rows-per-page + range read-out + prev/next, sized to sit under a grid. */
export function TablePagination({
  page,
  pages,
  pageSize,
  pageSizes,
  total,
  from,
  to,
  onPage,
  onPageSize,
}: {
  page: number;
  pages: number;
  pageSize: number;
  pageSizes: readonly number[];
  total: number;
  from: number;
  to: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t('pg_per')}
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger size="sm" className="h-8 w-[68px] px-2.5 text-xs" aria-label={t('pg_per')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <span className="text-data text-muted-foreground tabular-nums">
        {total === 0 ? 0 : from}–{to} / {total}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label={t('pg_prev')}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="text-data text-foreground tabular-nums">
        {page}/{pages}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        aria-label={t('pg_next')}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

/** Load failure with a retry — wired to react-query's `refetch`. */
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid place-items-center gap-2 rounded-[10px] border border-dashed border-danger/30 bg-danger-tint/40 px-6 py-14 text-center">
      <AlertTriangleIcon className="size-7 text-danger/70" strokeWidth={1.5} />
      <p className="m-0 text-sm font-medium text-foreground">{t('err_load')}</p>
      <p className="m-0 max-w-[46ch] text-data text-muted-foreground">{t('err_load_hint')}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-1.5" onClick={onRetry}>
          <RotateCcwIcon />
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
