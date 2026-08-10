import {
  type CargoPost,
  useDistrictCargo,
  useDistricts,
  useDynamics,
  useRegions,
  useReport,
} from '@karier/api-client';
import {
  currentLang,
  formatDateTime,
  formatNumber,
  monthName,
  useTranslation,
} from '@karier/i18n';
import {
  Breadcrumb,
  ChartCard,
  ChartLegend,
  ChartTable,
  Chip,
  cn,
  type Crumb,
  EmptyState,
  ErrorState,
  FilterDate,
  GRID_ROW,
  localizedName,
  PageHeader,
  RankBars,
  StatTile,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  TONE_DOT,
  TrendColumns,
  UpdatedStamp,
} from '@karier/ui';
import {
  ActivityIcon,
  BarChart3Icon,
  CameraIcon,
  MountainIcon,
  TruckIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const DEFAULT_RANGE = {
  from: `${new Date().getFullYear()}-01-01`,
  to: isoDay(new Date()),
};

/** How many peer districts the ranking plots; this district is always among them. */
const TOP_N = 8;

/** A firm and everything it runs in this district, keyed by org (quarries without
 *  an owner fall back to their own bucket so no post disappears). */
type Firm = {
  id: string;
  name: string | null;
  trucks: number;
  events: number;
  sites: { id: string; name: string; posts: CargoPost[] }[];
};

function groupByFirm(posts: CargoPost[]): Firm[] {
  const firms = new Map<string, Firm>();
  for (const p of posts) {
    const key = p.org_id ?? `quarry:${p.quarry_id}`;
    let firm = firms.get(key);
    if (!firm) {
      firm = { id: key, name: p.org_name, trucks: 0, events: 0, sites: [] };
      firms.set(key, firm);
    }
    firm.trucks += p.trucks;
    firm.events += p.events;
    let site = firm.sites.find((s) => s.id === p.quarry_id);
    if (!site) {
      site = { id: p.quarry_id, name: p.quarry_name, posts: [] };
      firm.sites.push(site);
    }
    site.posts.push(p);
  }
  return [...firms.values()].sort((a, b) => b.trucks - a.trucks);
}

/** One eco-post row inside a firm card: code, throughput and camera health. */
function PostRow({ post, lang, t }: { post: CargoPost; lang: ReturnType<typeof currentLang>; t: (k: string) => string }) {
  return (
    <div className="flex items-center gap-2">
      <Chip tone="neutral" className="bg-primary-tint text-primary tabular-nums">
        {post.code}
      </Chip>
      <span className="flex items-center gap-[5px] text-data text-foreground">
        <ActivityIcon className="size-3.5 text-primary" strokeWidth={1.8} />
        <b className="tabular-nums">{formatNumber(post.events, lang)}</b>
      </span>
      <span className="flex items-center gap-[5px] text-data text-foreground">
        <TruckIcon className="size-3.5 text-primary" strokeWidth={1.8} />
        <b className="tabular-nums">{formatNumber(post.trucks, lang)}</b>
      </span>
      <span className="ml-auto flex gap-1" title={t('dash_cameras')}>
        {Array.from({ length: post.cameras }, (_, i) => (
          <span
            key={i}
            className={cn(
              'inline-block size-[9px] rounded-full',
              TONE_DOT[i < post.cameras_active ? 'success' : 'danger'],
            )}
          />
        ))}
      </span>
    </div>
  );
}

/** One firm: every quarry/plant it owns here, each with its own posts. */
function FirmCard({ firm, lang, t }: { firm: Firm; lang: ReturnType<typeof currentLang>; t: (k: string) => string }) {
  return (
    <article className="rounded-xl border bg-card px-3.5 py-3 shadow-card">
      <header className="mb-2.5 flex items-start justify-between gap-2 border-b pb-2">
        <h3 className="text-data font-semibold text-foreground">
          {firm.name ?? t('q_no_org')}
        </h3>
        <span className="flex shrink-0 items-center gap-1.5" title={t('dash_trucks_plural')}>
          <b className="text-data text-primary tabular-nums">{formatNumber(firm.trucks, lang)}</b>
          <TruckIcon className="size-3.5 text-primary" strokeWidth={1.8} />
        </span>
      </header>
      <div className="grid gap-2.5">
        {firm.sites.map((s) => (
          <div key={s.id}>
            <p className="m-0 mb-1 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {s.name}
            </p>
            <div className="grid gap-1.5">
              {s.posts.map((p) => (
                <PostRow key={p.id} post={p} lang={lang} t={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

/** Per-quarry cargo: what the eco-posts recorded vs what was declared. */
function CargoTable({
  rows,
  fn,
  t,
  onOpen,
}: {
  rows: { id: string; label: string; count: number; volume: number }[];
  fn: (v: number) => string;
  t: (k: string) => string;
  onOpen: (id: string) => void;
}) {
  const th =
    'h-auto border-b px-2 py-1 text-center text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground';
  const td = 'border-b p-2 text-data';
  const tdNum = cn(td, 'text-center font-bold tabular-nums');
  const tdMuted = cn(td, 'text-center font-normal text-muted-foreground tabular-nums');

  return (
    <Table className="mt-1.5 border-collapse">
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="hover:bg-transparent">
          <TableHead className={th} />
          <TableHead className={th} colSpan={2} scope="colgroup">{t('dash_ettyu')}</TableHead>
          <TableHead className={th} colSpan={2} scope="colgroup">{t('dash_diff')}</TableHead>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableHead className={th} />
          <TableHead className={th} scope="col">{t('rep_count')}</TableHead>
          <TableHead className={th} scope="col">{t('rep_vol')}</TableHead>
          <TableHead className={th} scope="col">{t('rep_count')}</TableHead>
          <TableHead className={th} scope="col">{t('rep_vol')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            onClick={() => onOpen(r.id)}
            title={t('q_open_hint')}
            className={cn(GRID_ROW, 'cursor-pointer border-0')}
          >
            <TableCell className={cn(td, 'font-semibold text-primary underline underline-offset-2')}>
              {r.label}
            </TableCell>
            <TableCell className={tdNum}>{fn(r.count)}</TableCell>
            <TableCell className={tdNum}>{fn(r.volume)}</TableCell>
            <TableCell className={tdMuted}>-</TableCell>
            <TableCell className={tdMuted}>-</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DistrictDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { districtId } = useParams<{ districtId: string }>();
  const lang = currentLang();

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();

  const [range, setRange] = useState(DEFAULT_RANGE);
  const { data: cargo, isLoading, isError, refetch } = useDistrictCargo(districtId, {
    date_from: range.from || undefined,
    date_to: range.to || undefined,
  });
  // M4 without a district filter: every district in the region over the same
  // range, which is what puts this one's numbers in context.
  const { data: byDistrict, isFetching: rankFetching } = useReport(4, {
    date_from: range.from || undefined,
    date_to: range.to || undefined,
  });
  const { data: dynamics, isFetching: dynFetching } = useDynamics({
    year: Number(range.from?.slice(0, 4)) || new Date().getFullYear(),
    ...(districtId ? { district_id: districtId } : {}),
  });

  const district = districts?.find((d) => d.id === districtId);
  const region = regions?.find((r) => r.id === district?.region_id);
  const posts = cargo?.posts ?? [];
  const firms = useMemo(() => groupByFirm(cargo?.posts ?? []), [cargo?.posts]);
  const quarryRows = useMemo(
    () =>
      (cargo?.quarries ?? []).map((q) => ({
        id: q.id,
        label: q.name,
        count: q.count,
        volume: q.volume,
      })),
    [cargo?.quarries],
  );

  // KPI numbers come off the cargo payload rather than /stats/overview, which
  // buckets by year+month and would ignore the from/to filter above it.
  const totals = useMemo(
    () => ({
      events: (cargo?.quarries ?? []).reduce((s, q) => s + q.count, 0),
      volume: (cargo?.quarries ?? []).reduce((s, q) => s + q.volume, 0),
      quarries: (cargo?.quarries ?? []).length,
      cameras: (cargo?.posts ?? []).reduce((s, p) => s + p.cameras, 0),
      camerasActive: (cargo?.posts ?? []).reduce((s, p) => s + p.cameras_active, 0),
    }),
    [cargo],
  );

  // M4 keys districts by their latin name; join back to the district list to get
  // the localized label, the current district's identity, and the region filter.
  const ranking = useMemo(() => {
    const peers = (districts ?? []).filter((d) => d.region_id === district?.region_id);
    const byName = new Map(peers.map((d) => [d.name_uz_latn, d]));
    const rows = (byDistrict?.rows ?? [])
      .filter((r) => byName.has(r.key))
      .map((r) => {
        const d = byName.get(r.key)!;
        return {
          id: d.id,
          label: localizedName(d),
          count: r.count,
          volume: Math.round(r.volume),
          current: d.id === districtId,
        };
      })
      .sort((a, b) => b.volume - a.volume);
    const total = rows.reduce((s, r) => s + r.volume, 0);
    const index = rows.findIndex((r) => r.current);
    return {
      rows,
      total,
      rank: index >= 0 ? index + 1 : null,
      share: total > 0 && index >= 0 ? Math.round((rows[index]!.volume / total) * 100) : null,
    };
  }, [byDistrict?.rows, districts, district?.region_id, districtId]);

  // Top N, but never drop this district off the chart — it is the whole point.
  const rankBars = useMemo(() => {
    const head = ranking.rows.slice(0, TOP_N);
    const self = ranking.rows.find((r) => r.current);
    const shown = self && !head.includes(self) ? [...head, self] : head;
    return shown.map((r) => ({
      label: r.label,
      value: r.volume,
      color: r.current ? 'var(--primary)' : 'var(--chart-context)',
    }));
  }, [ranking.rows]);

  const trend = (dynamics?.buckets ?? []).map((b) => ({
    month: String(b.month).padStart(2, '0'),
    name: monthName(b.month, lang),
    confirmed: b.confirmed,
    unconfirmed: Math.max(0, b.total - b.confirmed),
  }));
  const trendSeries = [
    { key: 'unconfirmed', label: t('an_unconfirmed'), color: 'var(--chart-context)' },
    { key: 'confirmed', label: t('an_confirmed'), color: 'var(--primary)' },
  ];

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);
  const districtLabel = district ? localizedName(district) : t('loading');
  const updatedAt = cargo?.last_event_at ? formatDateTime(cargo.last_event_at) : '—';

  const crumbs: Crumb[] = [
    { label: region ? localizedName(region) : t('region') },
    { label: districtLabel },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={districtLabel}
        breadcrumb={<Breadcrumb items={crumbs} onHome={() => navigate('/dashboard')} />}
        meta={<UpdatedStamp at={updatedAt} />}
        actions={
          <div className="flex items-end gap-2">
            <FilterDate
              label={t('rep_from')}
              value={range.from}
              onChange={(v) => setRange((r) => ({ ...r, from: v }))}
            />
            <FilterDate
              label={t('rep_to')}
              value={range.to}
              onChange={(v) => setRange((r) => ({ ...r, to: v }))}
            />
          </div>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
            <StatTile icon={ActivityIcon} label={t('dash_events')} value={fn(totals.events)} />
            <StatTile
              icon={BarChart3Icon}
              label={t('dash_ore_volume')}
              value={fn(Math.round(totals.volume))}
              unit="m³"
            />
            <StatTile icon={MountainIcon} label={t('dash_quarries')} value={fn(totals.quarries)} />
            <StatTile
              icon={CameraIcon}
              label={t('dash_cameras_active')}
              value={`${fn(totals.camerasActive)} / ${fn(totals.cameras)}`}
            />
          </div>

          {/* One card per firm; its posts sit inside, grouped by quarry/plant. */}
          {firms.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] items-start gap-3">
              {firms.map((f) => (
                <FirmCard key={f.id} firm={f} lang={lang} t={t} />
              ))}
            </div>
          ) : (
            <EmptyState title={t('q_empty')} hint={t('empty_no_data_hint')} />
          )}

          <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <header className="mb-2.5 flex items-center gap-2 border-b pb-2.5">
                <span className="inline-block size-2 rounded-full bg-primary" />
                <span className="text-data font-bold text-foreground">{t('jami')}</span>
                <span className="ml-auto text-lg font-bold text-foreground tabular-nums">
                  {fn(posts.reduce((s, p) => s + p.trucks, 0))}
                </span>
              </header>
              <div className="grid gap-2.5">
                {firms.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-data font-semibold text-foreground">
                      {f.name ?? t('q_no_org')}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <b className="text-data text-primary tabular-nums">{fn(f.trucks)}</b>
                      <TruckIcon className="size-3.5 text-primary" strokeWidth={1.8} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <h2 className="mb-3 text-base font-semibold tracking-[-0.01em] text-foreground">
                {t('dash_cargo_info')}{' '}
                <span className="text-data font-normal text-muted-foreground">
                  ({t('dash_trucks_plural')})
                </span>
              </h2>

              <p className="m-0 mb-3">
                <span className="text-data text-muted-foreground">{t('dash_trucks_total')}: </span>
                <b className="text-xl text-primary tabular-nums">{fn(cargo?.trucks_total)}</b>
              </p>

              {quarryRows.length > 0 ? (
                <CargoTable
                  rows={quarryRows}
                  fn={fn}
                  t={t}
                  onOpen={(id) => navigate(`/dashboard/districts/${districtId}/quarries/${id}`)}
                />
              ) : (
                <p className="mt-2.5 mb-0 text-data text-muted-foreground">{t('q_empty')}</p>
              )}

            </section>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <ChartCard
              title={t('an_cross_district')}
              subtitle={
                ranking.rank
                  ? `${t('an_rank')}: ${ranking.rank}/${ranking.rows.length} · ${t('an_share')}: ${ranking.share}%`
                  : t('an_cross_district_hint')
              }
              stale={rankFetching}
              legend={
                <ChartLegend
                  items={[
                    { label: t('an_this_district'), color: 'var(--primary)' },
                    { label: t('an_other_districts'), color: 'var(--chart-context)' },
                  ]}
                />
              }
              table={
                <ChartTable
                  head={[t('an_dim'), t('rep_count'), t('rep_vol')]}
                  rows={ranking.rows.map((r) => ({
                    key: r.id,
                    label: r.label,
                    values: [fn(r.count), fn(r.volume)],
                  }))}
                />
              }
            >
              {rankBars.length ? (
                <RankBars rows={rankBars} format={fn} />
              ) : (
                <p className="py-12 text-center text-data text-muted-foreground">{t('an_empty')}</p>
              )}
            </ChartCard>

            <ChartCard
              title={`${t('an_dynamics')} · ${range.from?.slice(0, 4) ?? ''}`}
              subtitle={t('an_dynamics_hint')}
              stale={dynFetching}
              legend={
                <ChartLegend items={trendSeries.map((s) => ({ label: s.label, color: s.color }))} />
              }
              table={
                <ChartTable
                  head={[t('an_month'), t('an_confirmed'), t('an_unconfirmed')]}
                  rows={trend.map((r) => ({
                    key: r.month,
                    label: r.month,
                    values: [fn(r.confirmed), fn(r.unconfirmed)],
                  }))}
                />
              }
            >
              {trend.length ? (
                <TrendColumns
                  data={trend}
                  series={trendSeries}
                  xKey="month"
                  format={fn}
                  labelFor={(m) => trend.find((r) => r.month === m)?.name ?? m}
                />
              ) : (
                <p className="py-12 text-center text-data text-muted-foreground">{t('an_empty')}</p>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
