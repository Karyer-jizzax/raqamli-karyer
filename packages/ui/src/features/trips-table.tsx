/**
 * Qatnovlar grid — one row per vehicle trip through the zavod scale.
 *
 * One component for both apps: web-quarry passes its own `quarryId`, the
 * department passes none and gets the quarry column plus a quarry filter.
 */
import { type TripRecord, type TripStage, useQuarries, useTrips } from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import { FileTextIcon } from 'lucide-react';
import { type MouseEvent, useMemo, useState } from 'react';

import {
  DataGrid,
  DataTable,
  EmptyState,
  ErrorState,
  GRID_CELL,
  GRID_CTR,
  GRID_NUM,
  GRID_ROW,
  GRID_TH,
  GRID_TH_SUB,
  TablePagination,
  TableSkeleton,
  Unit,
} from '../data-table';
import { FilterBar, FilterSelect, FilterText, useFilterPanel } from '../filters';
import { cn } from '../lib/utils';
import { PlateBadge } from '../plate';
import { Chip, TONE_TEXT, TRIP_KIND_TONE, TRIP_STAGE_TONE } from '../status';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { WaybillViewer } from '../waybill';
import { HoverPreview, MediaChips, type Preview, StageSection } from './media';
import { type Filters, plateMatches, setFilter, splitDateTime } from './util';

const KINDS = ['karyer', 'tashqi'] as const;
// Only zavod-side trips are listed, so karyerda/yolda can never appear here.
const STAGES = ['zavodda', 'yakunlandi', 'yuk_emas', 'chala'] as const;
const PAGE_SIZES = [10, 25, 50] as const;

/** One checkpoint cell: time on top, weight (scale stages), then media chips. */
function StageCell({
  at,
  stage,
  weightKg,
  onPreview,
}: {
  at: string | null;
  stage: TripStage | null;
  weightKg?: number | null;
  onPreview: (p: Preview | null) => void;
}) {
  const lang = currentLang();
  const dt = splitDateTime(at ?? stage?.occurred_at ?? null);
  if (!dt && !stage) {
    return (
      <td className={GRID_CTR}>
        <span className="text-slate-300">—</span>
      </td>
    );
  }
  // Two lines, not four: date and time share a line, weight and the media
  // chips share the next. Halving the row height doubles the rows on screen.
  return (
    <td className={GRID_CTR}>
      {dt && (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {dt.date} <b className="text-foreground">{dt.time}</b>
        </span>
      )}
      {(weightKg != null || stage) && (
        <span className="flex items-center justify-center gap-1.5">
          {weightKg != null && (
            <b className="font-semibold text-primary tabular-nums">
              {formatDecimal(weightKg / 1000, lang)}
              <Unit>t</Unit>
            </b>
          )}
          {stage && <MediaChips stage={stage} onPreview={onPreview} />}
        </span>
      )}
    </td>
  );
}

/** Per-stage evidence for the clicked trip. */
function TripDialog({ trip, onClose }: { trip: TripRecord; onClose: () => void }) {
  const { t } = useTranslation();
  const hasMedia = Boolean(trip.main_enter || trip.main_exit);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="gap-0 p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2.5 text-sm font-semibold">
            {t('trip_detail')}
            <PlateBadge region={trip.plate_region} number={trip.plate_number} />
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto px-4 pb-1">
          {hasMedia ? (
            <>
              <StageSection label={t('th_main_enter')} stage={trip.main_enter} />
              <StageSection label={t('th_main_exit')} stage={trip.main_exit} />
            </>
          ) : (
            <p className="m-0 py-12 text-center text-muted-foreground">{t('vid_no_image')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TripsTable({ quarryId }: { quarryId?: string } = {}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const showQuarry = !quarryId;
  const { data: quarries } = useQuarries();
  // main_only: zavod tarozisiga yetmagan (karyerda/yo'lda) qatnovlar ko'rinmaydi.
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useTrips(
    quarryId
      ? { limit: '200', main_only: 'true', quarry_id: quarryId }
      : { limit: '200', main_only: 'true' },
  );

  const [f, setF] = useState<Filters>({});
  const [sel, setSel] = useState<TripRecord | null>(null);
  const [waybillOf, setWaybillOf] = useState<string | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
  const [filtersOpen, setFiltersOpen] = useFilterPanel();
  const set = (k: string) => (v: string) => {
    setPage(1);
    setF((p) => setFilter(p, k, v));
  };
  const clear = () => {
    setPage(1);
    setF({});
  };

  const quarryById = useMemo(() => {
    const m = new Map<string, string>();
    (quarries ?? []).forEach((q) => m.set(q.id, q.name));
    return m;
  }, [quarries]);

  const rows = useMemo(() => data ?? [], [data]);

  // Client-side filtering over the single fetch (mirrors the M-1 grid).
  const filtered = rows.filter((r) => {
    if (f.quarry && r.quarry_id !== f.quarry) return false;
    if (f.kind && r.kind !== f.kind) return false;
    if (f.stage && r.stage !== f.stage) return false;
    if (f.plate && !plateMatches(f.plate, r.plate_region, r.plate_number)) return false;
    return true;
  });

  // Quarry filter options from the fetched trips (only quarries with data).
  const quarryOpts = useMemo(
    () =>
      [...new Set(rows.map((r) => r.quarry_id))].map(
        (id): [string, string] => [id, quarryById.get(id) ?? id],
      ),
    [rows, quarryById],
  );

  // Hom ashyo (karyerdan keltirilgan) va sotuv (zavoddan chiqarilgan) qarama-
  // qarshi oqimlar — bitta yig'indiga qo'shilsa raqam ma'nosini yo'qotadi,
  // shuning uchun har tur alohida sanaladi. no_cargo (yuk emas) qatorlar
  // materialga kirmaydi, lekin qatnov sifatida sanaladi.
  const totals = KINDS.map((kind) => {
    const kindRows = filtered.filter((r) => r.kind === kind);
    const cargo = kindRows.filter((r) => r.status !== 'no_cargo');
    return {
      kind,
      count: kindRows.length,
      netto: cargo.reduce((s, r) => s + (r.netto_kg ?? 0), 0),
      m3: cargo.reduce((s, r) => s + (r.volume_m3 ?? 0), 0),
    };
  });
  const tons = (kg: number | null) => (kg == null ? '-' : formatDecimal(kg / 1000, lang));
  const cubes = (m3: number | null) => (m3 == null ? '-' : formatDecimal(m3, lang));

  // Client-side pagination over the filtered set (filters reset to page 1).
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const pageStart = (cur - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const activeCount = Object.keys(f).length;
  // +1 for the yuk xati action column
  const cols = showQuarry ? 10 : 9;

  return (
    <div className="flex flex-col gap-3.5">
      <FilterBar
        activeCount={activeCount}
        onClear={clear}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
      >
        {showQuarry && (
          <FilterSelect
            label={t('q_name')}
            value={f.quarry}
            onChange={set('quarry')}
            options={quarryOpts}
          />
        )}
        <FilterSelect
          label={t('trip_kind')}
          value={f.kind}
          onChange={set('kind')}
          options={KINDS.map((k) => [k, t(`trip_kind_${k}`)])}
        />
        <FilterSelect
          label={t('filt_status')}
          value={f.stage}
          onChange={set('stage')}
          options={STAGES.map((s) => [s, t(`stage_${s}`)])}
        />
        <FilterText
          label={t('filt_plate')}
          value={f.plate}
          onChange={set('plate')}
          placeholder={t('filt_plate_ph')}
        />
      </FilterBar>

      <section className="rounded-2xl border bg-card p-3.5 shadow-card">
        {isLoading ? (
          <TableSkeleton rows={8} cols={cols} />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={activeCount ? t('empty_no_match') : t('empty_no_data')}
            hint={activeCount ? t('empty_no_match_hint') : t('empty_no_data_hint')}
            action={
              activeCount ? (
                <Button variant="outline" size="sm" onClick={clear}>
                  {t('flt_clear')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable>
              <DataGrid>
                <thead>
                  <tr>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_no')}</th>
                    {showQuarry && (
                      <th rowSpan={2} className={GRID_TH} scope="col">{t('q_name')}</th>
                    )}
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_plate')}</th>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('trip_kind')}</th>
                    <th colSpan={2} className={GRID_TH} scope="colgroup">{t('grp_zavod')}</th>
                    <th colSpan={2} className={cn(GRID_TH, 'bg-col-ai')} scope="colgroup">
                      {t('grp_ai')}
                    </th>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_status')}</th>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('wb_open')}</th>
                  </tr>
                  <tr>
                    <th className={GRID_TH_SUB} scope="col">{t('dir_enter')}</th>
                    <th className={GRID_TH_SUB} scope="col">{t('dir_exit')}</th>
                    <th className={cn(GRID_TH_SUB, 'bg-col-ai')} scope="col">{t('th_m3')}</th>
                    <th className={cn(GRID_TH_SUB, 'bg-col-ai')} scope="col">{t('th_ton')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const noCargo = r.status === 'no_cargo';
                    const metric = cn(
                      GRID_NUM,
                      'bg-col-ai font-bold',
                      noCargo && 'bg-surface-subtle text-slate-400 line-through',
                    );
                    return (
                      <tr
                        key={r.id}
                        className={cn(GRID_ROW, 'cursor-pointer')}
                        onClick={() => setSel(r)}
                      >
                        <td className={cn(GRID_CTR, 'tabular-nums')}>{pageStart + i + 1}</td>
                        {showQuarry && (
                          <td className={GRID_CTR}>{quarryById.get(r.quarry_id) ?? '—'}</td>
                        )}
                        <td className={GRID_CTR}>
                          <PlateBadge region={r.plate_region} number={r.plate_number} />
                        </td>
                        <td className={GRID_CTR}>
                          <span className={cn('font-semibold', TONE_TEXT[TRIP_KIND_TONE[r.kind]])}>
                            {t(`trip_kind_${r.kind}`)}
                          </span>
                        </td>
                        <StageCell
                          at={r.main_enter_at}
                          stage={r.main_enter}
                          weightKg={r.enter_weight_kg}
                          onPreview={setPrev}
                        />
                        <StageCell
                          at={r.main_exit_at}
                          stage={r.main_exit}
                          weightKg={r.exit_weight_kg}
                          onPreview={setPrev}
                        />
                        <td className={metric}>{cubes(r.volume_m3)}</td>
                        <td className={metric}>{tons(r.netto_kg)}</td>
                        <td className={GRID_CTR}>
                          <Chip tone={TRIP_STAGE_TONE[r.stage]}>{t(`stage_${r.stage}`)}</Chip>
                        </td>
                        <td className={GRID_CTR}>
                          {/* Stop the click here: the row itself opens the media dialog. */}
                          <Button
                            variant="outline"
                            size="sm"
                            title={t('wb_open')}
                            aria-label={t('wb_open')}
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              setWaybillOf(r.id);
                            }}
                          >
                            <FileTextIcon className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {totals.map((x, i) => {
                    const top = i === 0 && 'border-t-2 border-t-col-ai-rule';
                    return (
                      <tr key={x.kind} className="bg-col-ai font-bold">
                        <td className={cn(GRID_CTR, top)} colSpan={showQuarry ? 6 : 5}>
                          {t(`trip_kind_${x.kind}`)} ({x.count})
                        </td>
                        <td className={cn(GRID_NUM, top)}>{cubes(x.m3)}</td>
                        <td className={cn(GRID_NUM, top)}>{tons(x.netto)}</td>
                        <td className={cn(GRID_CELL, top)} colSpan={2} />
                      </tr>
                    );
                  })}
                </tfoot>
              </DataGrid>
            </DataTable>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-data text-muted-foreground">
                <span>
                  {t('trips_total')}: <b className="text-foreground tabular-nums">{filtered.length}</b>
                </span>
                {totals.map((x) => (
                  <span key={x.kind}>
                    · {t(`trip_kind_${x.kind}`)}:{' '}
                    <b className="text-foreground tabular-nums">
                      {cubes(x.m3)}
                      <Unit>{t('vol_unit')}</Unit> / {tons(x.netto)}
                      <Unit>t</Unit>
                    </b>
                  </span>
                ))}
              </div>
              <TablePagination
                page={cur}
                pages={pages}
                pageSize={pageSize}
                pageSizes={PAGE_SIZES}
                total={filtered.length}
                from={pageStart + 1}
                to={Math.min(pageStart + pageSize, filtered.length)}
                onPage={setPage}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </section>

      {/* Hover media preview (photo / silent looping clip). */}
      {prev && <HoverPreview prev={prev} />}
      {sel && <TripDialog trip={sel} onClose={() => setSel(null)} />}
      {waybillOf && <WaybillViewer tripId={waybillOf} onClose={() => setWaybillOf(null)} />}
    </div>
  );
}
