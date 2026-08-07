/**
 * Chart primitives for the dashboards.
 *
 * One mark spec across every chart: thin bars capped at 24px with a 4px rounded
 * data-end, a 2px surface gap between stacked segments, hairline solid grid,
 * recessive axes. Recharts only does the geometry — every color comes from a
 * token so the per-app accent carries through.
 *
 * Two rules the cards enforce rather than leave to the caller: no value is only
 * reachable by pointing at it (each card can flip to a table), and a refetch
 * dims the old render instead of flashing a skeleton.
 */
import { useTranslation } from '@karier/i18n';
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  type LucideIcon,
  MinusIcon,
  TableIcon,
} from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from './lib/utils';
import { Button } from './ui/button';

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 } as const;
const GRID = 'var(--grid)';
/** Stacked/adjacent fills are separated by a gap in the surface color, not a border. */
const SURFACE = 'var(--card)';

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Categorical slots for a form where every mark can end up beside every other
 * one — a ring, a map, a scatter — rather than only next to its neighbour in a
 * stack.
 *
 * Four slots, and not `--chart-1..4` in order: `--chart-4` (violet) and
 * `--chart-1` (blue) are ΔE 0.3 apart under deuteranopia. In a stack they are
 * never adjacent so the full five-slot order holds; in a ring they face each
 * other and that pair is simply gone. Blue → teal → amber → crimson clears the
 * all-pairs check on the card surface for normal vision and all three CVD
 * types.
 *
 * A fifth category is never a generated hue: it folds into CHART_CONTEXT.
 */
export const CHART_SLOTS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-5)',
] as const;

/** "Boshqalar" / "aniqlanmagan" — context, never an identity color. */
export const CHART_CONTEXT = 'var(--chart-context)';

function TooltipBox({
  rows,
  title,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-[10px] border bg-card px-3 py-2 shadow-card">
      <div className="mb-1 text-2xs font-semibold text-muted-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-data">
          {r.color && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: r.color }}
              aria-hidden
            />
          )}
          <span className="text-muted-foreground">{r.label}</span>
          <b className="ml-auto text-foreground tabular-nums">{r.value}</b>
        </div>
      ))}
    </div>
  );
}

/**
 * One headline number. A single value is a figure, not a chart — no one-bar bar
 * charts here.
 *
 * @param delta   Signed change against a named period, e.g. "+12% (o'tgan oy)".
 * @param good    Which direction is the good one; decides the delta's color.
 *                Omit for a metric where neither direction is a verdict.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  deltaLabel,
  good,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
  good?: 'up' | 'down';
  className?: string;
}) {
  const dir = delta == null || delta === 0 ? 0 : delta > 0 ? 1 : -1;
  const tone =
    dir === 0 || !good
      ? 'text-muted-foreground'
      : (good === 'up') === dir > 0
        ? 'text-success'
        : 'text-danger';
  const Arrow = dir > 0 ? ArrowUpRightIcon : dir < 0 ? ArrowDownRightIcon : MinusIcon;
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border bg-card px-[18px] py-4 shadow-card',
        className,
      )}
    >
      {Icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary-tint text-primary">
          <Icon className="size-5" strokeWidth={1.7} />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-xs leading-tight text-muted-foreground">{label}</div>
        {/* Proportional figures: tabular digits read loose at this size. */}
        <div className="text-xl font-bold text-foreground">
          {value}
          {unit && (
            <span className="ml-1 text-2xs font-semibold text-muted-foreground">{unit}</span>
          )}
        </div>
        {delta != null && (
          <div className={cn('mt-0.5 flex items-center gap-1 text-2xs font-semibold', tone)}>
            <Arrow className="size-3" strokeWidth={2.2} aria-hidden />
            {dir > 0 ? '+' : ''}
            {delta}%
            {deltaLabel && <span className="font-normal text-muted-foreground">{deltaLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Legend swatches. Identity never rides on color alone — the label is always there. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="m-0 flex flex-wrap items-center gap-x-3.5 gap-y-1 p-0">
      {items.map((it) => (
        <li
          key={it.label}
          className="flex list-none items-center gap-1.5 text-2xs text-muted-foreground"
        >
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ background: it.color }}
            aria-hidden
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Card wrapper: title, legend, the chart, and a toggle to the same numbers as a
 * table. `stale` dims the body while a refetch is in flight.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  stale,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  /** Table view of the same data — required so a value is never hover-only. */
  table?: ReactNode;
  stale?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cn('flex flex-col rounded-2xl border bg-card p-5 shadow-card', className)}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <h2 className="m-0 text-sm font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {subtitle && <p className="m-0 mt-0.5 text-2xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2.5">
          {!asTable && legend}
          {table && (
            <Button
              variant="outline"
              size="icon"
              aria-pressed={asTable}
              title={t(asTable ? 'chart_view_chart' : 'chart_view_table')}
              aria-label={t(asTable ? 'chart_view_chart' : 'chart_view_table')}
              onClick={() => setAsTable((v) => !v)}
              className={cn('size-7 rounded-[7px]', asTable && 'bg-primary-tint text-primary')}
            >
              <TableIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </header>
      <div className={cn('min-w-0 flex-1 transition-opacity', stale && 'opacity-50')}>
        {asTable && table ? table : children}
      </div>
    </section>
  );
}

/** Table twin for a chart: two or three columns, right-aligned numbers. */
export function ChartTable({
  head,
  rows,
}: {
  head: string[];
  rows: { key: string; label: ReactNode; values: string[] }[];
}) {
  return (
    <div className="max-h-[260px] overflow-auto rounded-[10px] border border-grid">
      <table className="w-full border-collapse text-data">
        <thead className="sticky top-0 z-[1] bg-surface-subtle">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  'border-b border-grid px-2.5 py-1.5 text-2xs font-semibold tracking-[0.06em] text-muted-foreground uppercase',
                  i === 0 ? 'text-left' : 'text-right',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-grid last:border-b-0">
              <td className="px-2.5 py-1.5 text-foreground">{r.label}</td>
              {r.values.map((v, i) => (
                <td
                  key={i}
                  className="px-2.5 py-1.5 text-right font-semibold text-foreground tabular-nums"
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Columns over a time axis. One series is a plain column chart; two or more
 * stack, newest series on top, separated by the surface gap.
 */
export function TrendColumns({
  data,
  series,
  xKey,
  height = 240,
  format = (v: number) => String(v),
  labelFor,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  xKey: string;
  height?: number;
  format?: (v: number) => string;
  /** Tooltip heading for a tick — the axis stays short, the tooltip spells it out. */
  labelFor?: (tick: string) => string;
}) {
  const stacked = series.length > 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          cursor={{ fill: 'var(--surface-hover)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                title={labelFor ? labelFor(String(label)) : String(label)}
                rows={payload.map((p) => ({
                  label: series.find((s) => s.key === p.dataKey)?.label ?? String(p.dataKey),
                  value: format(Number(p.value ?? 0)),
                  color: String(p.color),
                }))}
              />
            ) : null
          }
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId={stacked ? 'a' : undefined}
            fill={s.color}
            maxBarSize={24}
            // Only the top of the stack carries the rounded data-end; the
            // baseline stays square.
            radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
            stroke={stacked ? SURFACE : undefined}
            strokeWidth={stacked ? 2 : undefined}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Ranked horizontal bars — magnitude over nominal categories, so every bar
 * wears the same hue and the value rides the tip. A row may override that hue
 * to single itself out of the ranking (e.g. "you are here"); the label still
 * carries the identity, color only reinforces it.
 */
export function RankBars({
  rows,
  color = 'var(--primary)',
  height,
  format = (v: number) => String(v),
}: {
  rows: { label: string; value: number; color?: string }[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const h = height ?? Math.max(120, rows.length * 34 + 16);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={132}
        />
        <Tooltip
          cursor={{ fill: 'var(--surface-hover)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={String(payload[0]?.payload?.label ?? '')}
                rows={[
                  {
                    label: '',
                    value: format(Number(payload[0]?.value ?? 0)),
                    color: payload[0]?.payload?.color ?? color,
                  },
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey="value"
          fill={color}
          maxBarSize={20}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        >
          {rows.map((r, i) => (
            <Cell key={`${r.label}-${i}`} fill={r.color ?? color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => format(Number(v))}
            className="fill-muted-foreground text-2xs tabular-nums"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * The identity channel for a part-to-whole figure: swatch, label, value, share.
 * Both part-to-whole forms carry it, so no slice is readable only by hovering
 * it and no label has to be squeezed inside a mark.
 */
function ShareList({
  segments,
  total,
  format,
}: {
  segments: Segment[];
  total: number;
  format: (v: number) => string;
}) {
  return (
    <ul className="m-0 grid gap-1.5 p-0">
      {segments.map((s) => (
        <li key={s.key} className="flex list-none items-center gap-2 text-data">
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ background: s.color }}
            aria-hidden
          />
          <span className="min-w-0 truncate text-muted-foreground">{s.label}</span>
          <b className="ml-auto shrink-0 text-foreground tabular-nums">{format(s.value)}</b>
          <span className="w-11 shrink-0 text-right text-2xs text-muted-foreground tabular-nums">
            {total ? Math.round((s.value / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Part-to-whole in one bar. Plain CSS — no plotting needed for a single row,
 * and the 2px surface gaps stay exact. Segments carry status colors, so each
 * one ships with its label and count in the legend below.
 */
export function SplitBar({
  segments,
  format = (v: number) => String(v),
}: {
  segments: Segment[];
  format?: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-secondary">
        {shown.map((s) => (
          <span
            key={s.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: s.color, width: `${total ? (s.value / total) * 100 : 0}%` }}
            aria-hidden
          />
        ))}
      </div>
      <ShareList segments={segments} total={total} format={format} />
    </div>
  );
}

/**
 * Part-to-whole as a ring, with the total it adds up to in the middle.
 *
 * The ring is for a share read at a glance over a handful of named categories —
 * six segments is the ceiling and close values belong in `RankBars` instead,
 * because arcs are much harder to compare than bar lengths. What earns it its
 * place here is the hole: the total sits in it, so one card answers both "how
 * much altogether" and "split how" without a second figure beside it.
 *
 * Every slice's number and share live in the list next to the ring, so nothing
 * is hover-only and no label has to fit inside an arc.
 */
export function DonutChart({
  segments,
  centerLabel,
  format = (v: number) => String(v),
  size = 176,
}: {
  segments: Segment[];
  /** What the middle number counts — the ring itself can't say it. */
  centerLabel?: string;
  format?: (v: number) => string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const shown = segments.filter((s) => s.value > 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    // h-full + centering: the ring is short, so in a row next to a taller card
    // it sits in the middle of its own instead of hugging the title.
    <div className="flex h-full flex-col items-center justify-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {/* Above the center figure: the plot is transparent where the hole is,
            so the total still reads through — but the tooltip lives in here and
            has to cover the total when it crosses it, not be covered by it. */}
        <div className="relative z-10 size-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shown}
                dataKey="value"
                nameKey="label"
                innerRadius="66%"
                outerRadius="100%"
                // One slice has no neighbour to be separated from, and a padded
                // 360° arc renders as a ring with a notch cut out of it.
                paddingAngle={shown.length > 1 ? 2 : 0}
                cornerRadius={4}
                stroke={SURFACE}
                strokeWidth={2}
                isAnimationActive={false}
              >
                {shown.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const seg = payload?.[0]?.payload as Segment | undefined;
                  return active && seg ? (
                    <TooltipBox
                      title={seg.label}
                      rows={[
                        { label: `${pct(seg.value)}%`, value: format(seg.value), color: seg.color },
                      ]}
                    />
                  ) : null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Sits under the plot, so it must not eat the ring's hover either. */}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {/* Proportional figures: tabular digits read loose at this size. */}
          <div className="text-xl leading-none font-bold text-foreground">{format(total)}</div>
          {centerLabel && <div className="mt-1 text-2xs text-muted-foreground">{centerLabel}</div>}
        </div>
      </div>
      <div className="min-w-0 flex-1 self-stretch sm:self-center">
        <ShareList segments={segments} total={total} format={format} />
      </div>
    </div>
  );
}

/**
 * One rate over time: a 2px line on a wash of its own hue.
 *
 * A rate is not a count, so it never shares a plot with one — a second y-scale
 * would invent a correlation the data doesn't have. It gets its own card, and
 * the shape of the line is the whole point, which is why this is a line and the
 * volume beside it is columns.
 *
 * A month with no events has no rate — `null`, and the line breaks there rather
 * than drawing a drop to zero that never happened. Only the last real point is
 * labelled: a number on every point goes unread.
 */
export function TrendLine({
  data,
  xKey,
  valueKey,
  label,
  color = 'var(--primary)',
  height = 220,
  format = (v: number) => String(v),
  domain,
  labelFor,
}: {
  data: Record<string, string | number | null>[];
  xKey: string;
  valueKey: string;
  /** Series name for the tooltip row. One series needs no legend box — the
      card title already says what is plotted. */
  label: string;
  color?: string;
  height?: number;
  format?: (v: number) => string;
  /** Fix the scale when the metric has natural bounds (a percentage). */
  domain?: [number, number];
  labelFor?: (tick: string) => string;
}) {
  // Unique per instance: two of these on one screen would otherwise share (and
  // fight over) a single <defs> gradient id.
  const gradId = `trend-fill-${useId().replace(/:/g, '')}`;
  const lastReal = data.reduce((acc, d, i) => (d[valueKey] == null ? acc : i), -1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* Less of a negative left inset than the column charts get: a percentage
          tick ("100%") is wider than the counts they carry, and -18 clipped its
          first digit. */}
      <AreaChart data={data} margin={{ top: 16, right: 30, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.16} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={52}
          domain={domain}
          tickFormatter={(v) => format(Number(v))}
        />
        <Tooltip
          cursor={{ stroke: GRID }}
          content={({ active, payload, label: tick }) => {
            const v = payload?.[0]?.value;
            return active && v != null ? (
              <TooltipBox
                title={labelFor ? labelFor(String(tick)) : String(tick)}
                rows={[{ label, value: format(Number(v)), color }]}
              />
            ) : null;
          }}
        />
        <Area
          type="monotone"
          dataKey={valueKey}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`url(#${gradId})`}
          // The line is continuous; a dot per month would out-weigh it. The
          // hover dot carries the 2px surface ring so it stays legible on the
          // line it sits on.
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        >
          <LabelList
            dataKey={valueKey}
            content={(props) => {
              const { index, x, y, value } = props as {
                index?: number;
                x?: number;
                y?: number;
                value?: number | null;
              };
              if (index !== lastReal || value == null || x == null || y == null) return null;
              return (
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  className="fill-foreground text-2xs font-semibold"
                >
                  {format(Number(value))}
                </text>
              );
            }}
          />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Column chart over a fixed set of buckets (hour of day). One series, so one
 * hue for every column — the height already carries the magnitude.
 */
export function BucketColumns({
  data,
  xKey,
  valueKey,
  color = 'var(--primary)',
  height = 180,
  format = (v: number) => String(v),
  tooltipLabel,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  valueKey: string;
  color?: string;
  height?: number;
  format?: (v: number) => string;
  tooltipLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval={1}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          cursor={{ fill: 'var(--surface-hover)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox
                title={String(label)}
                rows={[
                  { label: tooltipLabel, value: format(Number(payload[0]?.value ?? 0)), color },
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey={valueKey}
          fill={color}
          maxBarSize={18}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
