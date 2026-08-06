/**
 * M-1 hodisalar jurnali — the raw camera event log, laid out like the paper
 * M-1 form it stands in for (column groups: hodisa / AI o'lchov / material /
 * YHXX). One component for both apps; the department passes no `quarryId` and
 * gets the extra quarry column, filter and Excel column.
 */
import {
  ApiError,
  type M1Row,
  type Material,
  mediaUrl,
  useM1,
  useMaterials,
  useQuarries,
  useUpdateEventPlate,
} from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import { DownloadIcon, EyeIcon, LoaderIcon, PlayIcon } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

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
  TableSkeleton,
  Unit,
} from '../data-table';
import { exportM1ToExcel } from '../export-events';
import { FilterBar, FilterSelect, FilterText, useFilterPanel } from '../filters';
import { cn } from '../lib/utils';
import { PlateBadge } from '../plate';
import { Field, ModalForm } from '../primitives';
import { Chip, directionTone, SOURCE_TONE, TONE_TEXT } from '../status';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { MediaDialog } from './media';
import { type Filters, plateMatches, setFilter, splitDateTime } from './util';

const STATUSES = ['confirm', 'flagged', 'inspect', 'no_plate'] as const;
const DIRECTIONS = ['exit', 'enter'] as const;

type Lang = ReturnType<typeof currentLang>;

/** Small outline icon button for the photo/video columns. */
const IC_BTN = cn(
  'size-7 rounded-[7px] text-primary',
  'hover:enabled:border-primary hover:enabled:bg-primary-tint hover:enabled:text-primary',
  'active:enabled:scale-[0.97] disabled:opacity-30',
);

function materialName(m: Material | undefined, lang: Lang): string {
  if (!m) return '-';
  return lang === 'ru' ? m.name_ru : lang === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
}

/** Manual plate entry for a "no_plate" event (RAQAMSIZ — ANPR failed).
    On save the server re-links the event into its trip automatically. */
function FixPlateModal({ row, onClose }: { row: M1Row; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateEventPlate();
  const [region, setRegion] = useState(row.plate_region);
  const [number, setNumber] = useState(row.plate_number);
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await update.mutateAsync({
        id: row.id,
        body: { plate_region: region.trim(), plate_number: number.trim() },
      });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('np_fix_title')}
      eyebrow={t('status_no_plate')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={update.isPending}
      submitLabel={t('q_save')}
    >
      <p className="m-0 -mt-1 text-data text-muted-foreground">{t('np_fix_hint')}</p>
      <div className="grid grid-cols-[110px_1fr] gap-2.5">
        <Field label={t('np_region')} value={region} onChange={setRegion} required={false} />
        <Field label={t('np_number')} value={number} onChange={setNumber} />
      </div>
    </ModalForm>
  );
}

/** Every logged pass of one vehicle, newest first. */
function VehicleHistory({
  plate,
  rows,
  matById,
  onClose,
}: {
  plate: { plate_region: string; plate_number: string };
  rows: M1Row[];
  matById: Map<string, Material>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const f2 = (n: number) => formatDecimal(n, lang);
  const f1 = (n: number) => {
    const s = n.toFixed(1);
    return lang === 'ru' ? s.replace('.', ',') : s;
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="gap-0 p-0 sm:max-w-[860px]">
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2.5 text-sm font-semibold">
            {t('veh_history_title')}
            <PlateBadge region={plate.plate_region} number={plate.plate_number} />
          </DialogTitle>
        </DialogHeader>
        <div className="p-3.5">
          {rows.length === 0 ? (
            <EmptyState title={t('veh_history_empty')} />
          ) : (
            <DataTable maxHeight="max-h-[62vh]">
              <DataGrid>
                <thead>
                  <tr>
                    <th className={GRID_TH} scope="col">{t('th_time')}</th>
                    <th className={GRID_TH} scope="col">{t('th_post')}</th>
                    <th className={GRID_TH} scope="col">{t('th_camera')}</th>
                    <th className={GRID_TH} scope="col">{t('th_dir')}</th>
                    <th className={GRID_TH} scope="col">{t('th_m3')}</th>
                    <th className={GRID_TH} scope="col">{t('th_ton')}</th>
                    <th className={GRID_TH} scope="col">{t('grp_mat')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const dt = splitDateTime(r.occurred_at);
                    return (
                      <tr key={r.id} className={GRID_ROW}>
                        <td className={cn(GRID_CTR, 'text-muted-foreground tabular-nums')}>
                          {dt?.date} <b className="text-foreground">{dt?.time}</b>
                        </td>
                        <td className={GRID_CTR}>{r.post_code ?? '—'}</td>
                        <td className={GRID_CTR}>{r.camera_label ?? '—'}</td>
                        <td className={GRID_CTR}>
                          <span
                            className={cn('font-semibold', TONE_TEXT[directionTone(r.direction)])}
                          >
                            {t(`dir_${r.direction}`)}
                          </span>
                        </td>
                        <td className={GRID_NUM}>{r.volume_final > 0 ? f1(r.volume_final) : '-'}</td>
                        <td className={GRID_NUM}>
                          {r.weight_kg > 0 ? f2(r.weight_kg / 1000) : '-'}
                        </td>
                        <td className={GRID_CELL}>
                          {r.material_id ? materialName(matById.get(r.material_id), lang) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataGrid>
            </DataTable>
          )}
          <p className="mt-2.5 mb-0 text-data text-muted-foreground">
            {t('veh_history_total')}: <b className="text-foreground tabular-nums">{rows.length}</b>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * @param statuses  Restricts the log to these statuses — how the work queues
 *                  ("Tekshirish kerak", "Huquqbuzarliklar") reuse this grid.
 *                  The status filter then only offers the allowed ones.
 */
export function M1Table({
  quarryId,
  statuses,
}: { quarryId?: string; statuses?: readonly string[] } = {}) {
  const { t } = useTranslation();
  const lang = currentLang();
  const showQuarry = !quarryId;
  const { data: materials } = useMaterials();
  const { data: quarries } = useQuarries();
  const { data, isLoading, isError, refetch } = useM1(
    quarryId ? { limit: '500', quarry_id: quarryId } : { limit: '500' },
  );

  const [f, setF] = useState<Filters>({});
  const [filtersOpen, setFiltersOpen] = useFilterPanel();
  const set = (k: string) => (v: string) => setF((p) => setFilter(p, k, v));
  const clear = () => setF({});

  const [media, setMedia] = useState<{ row: M1Row; mode: 'photo' | 'video' } | null>(null);
  const [history, setHistory] = useState<{ plate_region: string; plate_number: string } | null>(
    null,
  );
  const [fix, setFix] = useState<M1Row | null>(null);

  const matById = useMemo(() => {
    const m = new Map<string, Material>();
    (materials ?? []).forEach((x) => m.set(x.id, x));
    return m;
  }, [materials]);

  const quarryById = useMemo(() => {
    const m = new Map<string, string>();
    (quarries ?? []).forEach((q) => m.set(q.id, q.name));
    return m;
  }, [quarries]);

  const allRows = data?.rows;
  const rows = useMemo(() => {
    const list = allRows ?? [];
    return statuses ? list.filter((r) => statuses.includes(r.status)) : list;
  }, [allRows, statuses]);

  // Filter dropdown options derived from the full (unfiltered) result set, so
  // selecting one filter never collapses the others' choices.
  const quarryOpts = useMemo(
    () =>
      [...new Set(rows.map((r) => r.quarry_id))].map(
        (id): [string, string] => [id, quarryById.get(id) ?? id],
      ),
    [rows, quarryById],
  );
  const postOpts = useMemo(
    () => [...new Set(rows.map((r) => r.post_code).filter((x): x is string => !!x))],
    [rows],
  );
  const camOpts = useMemo(
    () => [...new Set(rows.map((r) => r.camera_label).filter((x): x is string => !!x))],
    [rows],
  );
  const vtypeOpts = useMemo(() => [...new Set(rows.map((r) => r.vtype).filter(Boolean))], [rows]);

  const vtypeLabel = (v: string) => (v === 'truck' ? t('vt_truck') : v === 'car' ? t('vt_car') : v);

  // All filtering is client-side over the single fetch (mirrors the reference).
  const filtered = rows.filter((r) => {
    if (f.quarry && r.quarry_id !== f.quarry) return false;
    if (f.source && (f.source === 'zavod') !== r.is_main) return false;
    if (f.post && r.post_code !== f.post) return false;
    if (f.camera && r.camera_label !== f.camera) return false;
    if (f.direction && r.direction !== f.direction) return false;
    if (f.vtype && r.vtype !== f.vtype) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.material_id && r.material_id !== f.material_id) return false;
    if (f.plate && !plateMatches(f.plate, r.plate_region, r.plate_number)) return false;
    return true;
  });

  const historyRows = useMemo(() => {
    if (!history) return [];
    return rows
      .filter(
        (r) =>
          r.plate_region === history.plate_region && r.plate_number === history.plate_number,
      )
      .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  }, [rows, history]);

  const totalVol = filtered.reduce((s, r) => s + (r.volume_final || 0), 0);
  const totalTon = filtered.reduce((s, r) => s + (r.weight_kg || 0), 0) / 1000;
  const f2 = (n: number) => formatDecimal(n, lang);
  const f1 = (n: number) => {
    const s = n.toFixed(1);
    return lang === 'ru' ? s.replace('.', ',') : s;
  };

  const activeCount = Object.keys(f).length;

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
          label={t('th_source')}
          value={f.source}
          onChange={set('source')}
          options={[
            ['zavod', t('grp_zavod')],
            ['karyer', t('grp_karyer')],
          ]}
        />
        <FilterSelect
          label={t('filt_post')}
          value={f.post}
          onChange={set('post')}
          options={postOpts.map((p) => [p, p])}
        />
        <FilterSelect
          label={t('filt_camera')}
          value={f.camera}
          onChange={set('camera')}
          options={camOpts.map((c) => [c, c])}
        />
        <FilterSelect
          label={t('filt_dir')}
          value={f.direction}
          onChange={set('direction')}
          options={DIRECTIONS.map((d) => [d, t(`dir_${d}`)])}
        />
        <FilterSelect
          label={t('filt_vtype')}
          value={f.vtype}
          onChange={set('vtype')}
          options={vtypeOpts.map((v) => [v, vtypeLabel(v)])}
        />
        <FilterSelect
          label={t('filt_status')}
          value={f.status}
          onChange={set('status')}
          options={(statuses ?? STATUSES).map((s) => [s, t(`status_${s}`)])}
        />
        <FilterSelect
          label={t('flt_material')}
          value={f.material_id}
          onChange={set('material_id')}
          options={(materials ?? []).map((m) => [m.id, materialName(m, lang)])}
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
          <TableSkeleton rows={10} cols={8} />
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
            <div className="mb-2.5 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void exportM1ToExcel({
                    rows: filtered,
                    materials: materials ?? [],
                    lang,
                    t,
                    quarryNames: showQuarry ? quarryById : undefined,
                    includeQuarry: showQuarry,
                    includeSource: true,
                  })
                }
                className="border-success/30 bg-success-tint text-success hover:bg-success-tint/70 hover:text-success"
              >
                <DownloadIcon />
                {t('export_excel')}
              </Button>
            </div>
            <DataTable reserve={72}>
              <DataGrid>
                <thead>
                  <tr>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_no')}</th>
                    {showQuarry && (
                      <th rowSpan={2} className={GRID_TH} scope="col">{t('q_name')}</th>
                    )}
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_post')}</th>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_camera')}</th>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_source')}</th>
                    <th rowSpan={2} className={GRID_TH} scope="col">{t('th_plate')}</th>
                    <th colSpan={5} className={GRID_TH} scope="colgroup">{t('grp_events')}</th>
                    <th colSpan={2} className={cn(GRID_TH, 'bg-col-ai')} scope="colgroup">
                      {t('grp_ai')}
                    </th>
                    <th colSpan={1} className={cn(GRID_TH, 'bg-col-mat')} scope="colgroup">
                      {t('grp_mat')}
                    </th>
                    <th colSpan={2} className={cn(GRID_TH, 'bg-col-own')} scope="colgroup">
                      {t('grp_yhxx')}
                    </th>
                  </tr>
                  <tr>
                    <th className={GRID_TH_SUB} scope="col">{t('th_type')}</th>
                    <th className={GRID_TH_SUB} scope="col">{t('th_dir')}</th>
                    <th className={GRID_TH_SUB} scope="col">{t('th_time')}</th>
                    <th className={GRID_TH_SUB} scope="col">{t('th_photo')}</th>
                    <th className={GRID_TH_SUB} scope="col">{t('th_video')}</th>
                    <th className={cn(GRID_TH_SUB, 'bg-col-ai')} scope="col">{t('th_m3')}</th>
                    <th className={cn(GRID_TH_SUB, 'bg-col-ai')} scope="col">{t('th_ton')}</th>
                    <th className={cn(GRID_TH_SUB, 'bg-col-mat')} scope="col">{t('th_matname')}</th>
                    <th className={cn(GRID_TH_SUB, 'bg-col-own')} scope="col">{t('th_stir')}</th>
                    <th className={cn(GRID_TH_SUB, 'bg-col-own')} scope="col">{t('th_owner')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const dt = splitDateTime(r.occurred_at);
                    const hasPhoto = (r.image_urls?.length ?? 0) > 0;
                    const hasVideo = Boolean(r.video_url);
                    return (
                      <tr key={r.id} className={GRID_ROW}>
                        <td className={cn(GRID_CTR, 'tabular-nums')}>{i + 1}</td>
                        {showQuarry && (
                          <td className={GRID_CTR}>{quarryById.get(r.quarry_id) ?? '—'}</td>
                        )}
                        <td className={GRID_CTR}>{r.post_code ?? '—'}</td>
                        <td className={GRID_CTR}>{r.camera_label ?? '—'}</td>
                        <td className={GRID_CTR}>
                          <Chip tone={SOURCE_TONE[r.is_main ? 'zavod' : 'karyer']}>
                            {t(r.is_main ? 'grp_zavod' : 'grp_karyer')}
                          </Chip>
                        </td>
                        <td className={GRID_CTR}>
                          {r.status === 'no_plate' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'h-auto rounded-full border-danger/30 bg-danger-tint px-2.5 py-1 text-2xs font-semibold text-danger',
                                'hover:bg-danger/15 hover:text-danger active:scale-[0.97]',
                              )}
                              title={t('np_fix_title')}
                              onClick={() => setFix(r)}
                            >
                              {t('status_no_plate')}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              className="h-auto rounded-md p-0 hover:bg-transparent focus-visible:ring-0 hover:[&>span]:shadow-[0_0_0_2px_var(--primary)] focus-visible:[&>span]:shadow-[0_0_0_2px_var(--primary)]"
                              title={t('veh_history_hint')}
                              onClick={() =>
                                setHistory({
                                  plate_region: r.plate_region,
                                  plate_number: r.plate_number,
                                })
                              }
                            >
                              <PlateBadge region={r.plate_region} number={r.plate_number} />
                            </Button>
                          )}
                        </td>
                        <td className={GRID_CTR}>{vtypeLabel(r.vtype)}</td>
                        <td className={GRID_CTR}>
                          <span
                            className={cn('font-semibold', TONE_TEXT[directionTone(r.direction)])}
                          >
                            {t(`dir_${r.direction}`)}
                          </span>
                        </td>
                        <td className={cn(GRID_CTR, 'text-muted-foreground tabular-nums')}>
                          {dt?.date} <b className="text-foreground">{dt?.time}</b>
                        </td>
                        <td className={GRID_CTR}>
                          <Button
                            variant="outline"
                            size="icon"
                            className={IC_BTN}
                            disabled={!hasPhoto}
                            onClick={() => setMedia({ row: r, mode: 'photo' })}
                            title={t('th_photo')}
                            aria-label={t('th_photo')}
                          >
                            <EyeIcon className="size-3.5" />
                          </Button>
                        </td>
                        <td className={GRID_CTR}>
                          {r.video_pending ? (
                            // Agent hodisasi: foto darhol keldi, klip sekin
                            // kanalda hali yuklanmoqda (doc.txt §3.1a) —
                            // "video yo'q" emas, "hali kelmadi".
                            <span
                              className="inline-flex items-center gap-1 text-2xs text-muted-foreground"
                              title={t('ev_video_pending')}
                            >
                              <LoaderIcon className="size-3.5 opacity-70" strokeWidth={1.8} />
                              {t('ev_video_pending_short')}
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="icon"
                              className={IC_BTN}
                              disabled={!hasVideo}
                              onClick={() => setMedia({ row: r, mode: 'video' })}
                              title={t('th_video')}
                              aria-label={t('th_video')}
                            >
                              <PlayIcon className="size-3.5" fill="currentColor" strokeWidth={0} />
                            </Button>
                          )}
                        </td>
                        <td className={GRID_NUM}>
                          {r.volume_final > 0 ? f1(r.volume_final) : '-'}
                        </td>
                        <td className={GRID_NUM}>
                          {r.weight_kg > 0 ? f2(r.weight_kg / 1000) : '-'}
                        </td>
                        <td className={GRID_CELL}>
                          {r.material_id ? materialName(matById.get(r.material_id), lang) : '-'}
                        </td>
                        <td className={cn(GRID_CTR, 'tabular-nums')}>{r.stir || '—'}</td>
                        <td className={GRID_CELL}>{r.owner_name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-col-ai font-bold">
                    <td
                      className={cn(GRID_CTR, 'border-t-2 border-t-col-ai-rule')}
                      colSpan={showQuarry ? 11 : 10}
                    >
                      {t('jami')} ({filtered.length})
                    </td>
                    <td className={cn(GRID_NUM, 'border-t-2 border-t-col-ai-rule')}>
                      {f1(totalVol)}
                    </td>
                    <td className={cn(GRID_NUM, 'border-t-2 border-t-col-ai-rule')}>
                      {f2(totalTon)}
                    </td>
                    <td className={cn(GRID_CELL, 'border-t-2 border-t-col-ai-rule')} colSpan={3} />
                  </tr>
                </tfoot>
              </DataGrid>
            </DataTable>

            <p className="mt-2.5 mb-0 text-data text-muted-foreground">
              {t('total_events')}: <b className="text-foreground tabular-nums">{filtered.length}</b>{' '}
              · {t('total_vol')}:{' '}
              <b className="text-foreground tabular-nums">
                {f2(totalVol)}
                <Unit>{t('vol_unit')}</Unit>
              </b>{' '}
              ·{' '}
              <b className="text-foreground tabular-nums">
                {f2(totalTon)}
                <Unit>t</Unit>
              </b>
            </p>
          </>
        )}
      </section>

      {fix && <FixPlateModal row={fix} onClose={() => setFix(null)} />}
      {history && (
        <VehicleHistory
          plate={history}
          rows={historyRows}
          matById={matById}
          onClose={() => setHistory(null)}
        />
      )}
      {media && (
        <MediaDialog
          title={
            <span className="flex items-center gap-2.5">
              {media.mode === 'photo' ? t('th_photo') : t('th_video')}
              <PlateBadge region={media.row.plate_region} number={media.row.plate_number} />
            </span>
          }
          mode={media.mode}
          imageUrls={media.row.image_urls ?? []}
          videoUrl={media.row.video_url}
          posterUrl={mediaUrl(media.row.image_urls?.[0])}
          onClose={() => setMedia(null)}
        />
      )}
    </div>
  );
}
