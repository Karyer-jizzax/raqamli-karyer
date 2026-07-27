import { type CargoPost, useDistrictCargo, useDistricts, useRegions } from '@karier/api-client';
import { currentLang, formatDateTime, formatNumber, useTranslation } from '@karier/i18n';
import {
  Breadcrumb,
  Chip,
  cn,
  type Crumb,
  EmptyState,
  ErrorState,
  FilterDate,
  GRID_ROW,
  localizedName,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  TONE_DOT,
  UpdatedStamp,
} from '@karier/ui';
import { ActivityIcon, TruckIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const DEFAULT_RANGE = {
  from: `${new Date().getFullYear()}-01-01`,
  to: isoDay(new Date()),
};

/** One eco-post: its code, throughput and camera health. */
function EcoPostCard({ post, lang, t }: { post: CargoPost; lang: ReturnType<typeof currentLang>; t: (k: string) => string }) {
  return (
    <article className="min-w-[136px] shrink-0 rounded-xl border bg-card px-3 py-2.5 shadow-card">
      <Chip tone="neutral" className="mb-2 bg-primary-tint text-primary tabular-nums">
        {post.code}
      </Chip>
      <div className="mb-[3px] flex items-center gap-[5px] text-data text-foreground">
        <ActivityIcon className="size-3.5 text-primary" strokeWidth={1.8} />
        <b className="tabular-nums">{formatNumber(post.events, lang)}</b>
      </div>
      <div className="mb-2 flex items-center gap-[5px] text-data text-foreground">
        <TruckIcon className="size-3.5 text-primary" strokeWidth={1.8} />
        <b className="tabular-nums">{formatNumber(post.trucks, lang)}</b>
      </div>
      <div className="mb-1 text-2xs text-muted-foreground">{t('dash_cameras')}:</div>
      <div className="flex gap-1">
        {Array.from({ length: post.cameras }, (_, i) => (
          <span
            key={i}
            className={cn(
              'inline-block size-[9px] rounded-full',
              TONE_DOT[i < post.cameras_active ? 'success' : 'danger'],
            )}
          />
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

function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-[9px]',
        danger ? 'border-danger/20 bg-danger-tint' : 'bg-surface-subtle',
      )}
    >
      <span className={cn('text-data', danger ? 'text-danger' : 'text-muted-foreground')}>
        {label}:
      </span>
      <b className={cn('text-sm tabular-nums', danger ? 'text-danger' : 'text-foreground')}>
        {value}
      </b>
    </div>
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

  const district = districts?.find((d) => d.id === districtId);
  const region = regions?.find((r) => r.id === district?.region_id);
  const posts = cargo?.posts ?? [];
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
          {/* Eco-post cards strip */}
          {posts.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {posts.map((p) => (
                <EcoPostCard key={p.id} post={p} lang={lang} t={t} />
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
                {posts.map((p) => (
                  <div key={p.code} className="flex items-center justify-between gap-2">
                    <span className="text-data font-semibold text-foreground">{p.code}</span>
                    <div className="flex items-center gap-1.5">
                      <b className="text-data text-primary tabular-nums">{fn(p.trucks)}</b>
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

              <div className="mt-3.5">
                <StatBox label={t('dash_unidentified')} value={fn(cargo?.unidentified)} danger />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
