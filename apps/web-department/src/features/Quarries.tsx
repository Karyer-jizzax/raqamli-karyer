import { useDistricts, useQuarries } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  Chip,
  cn,
  DataGrid,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterSelect,
  FilterText,
  GRID_CELL,
  GRID_CTR,
  GRID_ROW,
  GRID_TH,
  localizedName,
  PageHeader,
  TableSkeleton,
  useAuth,
  useFilterPanel,
} from '@karier/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Flat quarry registry. The map is the right tool for "where", but an inspector
 * who already knows the quarry's name should not have to drill through it.
 */
export function Quarries() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: quarries, isLoading, isError, refetch } = useQuarries();
  const { data: districts } = useDistricts();
  // A tuman account's registry is one district by definition — a filter with a
  // single option is a control that can only repeat what the list already says.
  const lockedDistrict = user?.district_id ?? null;

  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [filtersOpen, setFiltersOpen] = useFilterPanel();

  const districtById = useMemo(() => {
    const m = new Map<string, string>();
    (districts ?? []).forEach((d) => m.set(d.id, localizedName(d)));
    return m;
  }, [districts]);

  const rows = quarries ?? [];
  const filtered = rows.filter((r) => {
    if (district && r.district_id !== district) return false;
    if (q) {
      const needle = q.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(needle) && !r.code.toLowerCase().includes(needle)) {
        return false;
      }
    }
    return true;
  });

  // Only districts that actually hold a quarry are worth offering.
  const districtOpts = useMemo(
    () =>
      [...new Set(rows.map((r) => r.district_id))]
        .map((id): [string, string] => [id, districtById.get(id) ?? id])
        .sort((a, b) => a[1].localeCompare(b[1])),
    [rows, districtById],
  );

  const activeCount = (q ? 1 : 0) + (district ? 1 : 0);
  const clear = () => {
    setQ('');
    setDistrict('');
  };

  const open = (quarryId: string, districtId: string) =>
    navigate(`/dashboard/districts/${districtId}/quarries/${quarryId}`);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('nav_quarries')}
        subtitle={t('ql_subtitle')}
      />

      <FilterBar
        activeCount={activeCount}
        onClear={clear}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
      >
        <FilterText label={t('q_name')} value={q} onChange={setQ} placeholder={t('ql_search')} />
        {!lockedDistrict && (
          <FilterSelect
            label={t('q_district')}
            value={district}
            onChange={setDistrict}
            options={districtOpts}
          />
        )}
      </FilterBar>

      <section className="rounded-2xl border bg-card p-3.5 shadow-card">
        {isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState title={activeCount ? t('empty_no_match') : t('ql_empty')} />
        ) : (
          <DataTable reserve={72}>
            <DataGrid>
              <thead>
                <tr>
                  <th className={GRID_TH} scope="col">
                    {t('th_no')}
                  </th>
                  <th className={GRID_TH} scope="col">
                    {t('q_name')}
                  </th>
                  <th className={GRID_TH} scope="col">
                    {t('q_code')}
                  </th>
                  <th className={GRID_TH} scope="col">
                    {t('q_district')}
                  </th>
                  <th className={GRID_TH} scope="col">
                    {t('q_status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className={cn(GRID_ROW, 'cursor-pointer')}
                    tabIndex={0}
                    onClick={() => open(r.id, r.district_id)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      open(r.id, r.district_id);
                    }}
                  >
                    <td className={cn(GRID_CTR, 'tabular-nums')}>{i + 1}</td>
                    <td className={cn(GRID_CELL, 'font-semibold text-primary')}>{r.name}</td>
                    <td className={cn(GRID_CTR, 'tabular-nums')}>{r.code}</td>
                    <td className={GRID_CELL}>{districtById.get(r.district_id) ?? '—'}</td>
                    <td className={GRID_CTR}>
                      <Chip tone={r.status === 'suspended' ? 'danger' : 'success'}>
                        {t(r.status === 'suspended' ? 'q_st_suspended' : 'q_st_active')}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataGrid>
          </DataTable>
        )}
        <p className="mt-2.5 mb-0 text-data text-muted-foreground">
          {t('dash_quarries')}: <b className="text-foreground tabular-nums">{filtered.length}</b>
        </p>
      </section>
    </div>
  );
}
