import {
  ApiError,
  type District,
  type Region,
  useCreateDistrict,
  useCreateRegion,
  useDeleteDistrict,
  useDeleteRegion,
  useDistricts,
  useRegions,
  useUpdateDistrict,
  useUpdateRegion,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UiButton as Button,
} from '@karier/ui';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import { districtName, Eyebrow, Field, ModalForm } from '../shared';

type NameForm = { name_uz_latn: string; name_uz_cyrl: string; name_ru: string };

const emptyNames: NameForm = { name_uz_latn: '', name_uz_cyrl: '', name_ru: '' };

function NameFields({ f, set }: { f: NameForm; set: (k: keyof NameForm) => (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Field label={t('geo_name_latn')} value={f.name_uz_latn} onChange={set('name_uz_latn')} />
      <Field label={t('geo_name_cyrl')} value={f.name_uz_cyrl} onChange={set('name_uz_cyrl')} />
      <Field label={t('geo_name_ru')} value={f.name_ru} onChange={set('name_ru')} />
    </>
  );
}

// ── region create / edit ─────────────────────────────────────────────────────
function RegionModal({ region, onClose }: { region: Region | null; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateRegion();
  const update = useUpdateRegion();
  const [f, setF] = useState<NameForm>(
    region
      ? {
          name_uz_latn: region.name_uz_latn,
          name_uz_cyrl: region.name_uz_cyrl,
          name_ru: region.name_ru,
        }
      : emptyNames,
  );
  const [err, setErr] = useState('');
  const set = (k: keyof NameForm) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      if (region) await update.mutateAsync({ id: region.id, body: f });
      else await create.mutateAsync(f);
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={region ? t('geo_edit_region') : t('geo_new_region')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={pending}
      submitLabel={region ? t('q_save') : t('q_create')}
    >
      <NameFields f={f} set={set} />
    </ModalForm>
  );
}

// ── district create / edit ───────────────────────────────────────────────────
function DistrictModal({
  regionId,
  district,
  onClose,
}: {
  regionId: string;
  district: District | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateDistrict();
  const update = useUpdateDistrict();
  const [f, setF] = useState<NameForm>(
    district
      ? {
          name_uz_latn: district.name_uz_latn,
          name_uz_cyrl: district.name_uz_cyrl,
          name_ru: district.name_ru,
        }
      : emptyNames,
  );
  const [isCapital, setIsCapital] = useState(district?.is_capital ?? false);
  const [err, setErr] = useState('');
  const set = (k: keyof NameForm) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      if (district) {
        await update.mutateAsync({ id: district.id, body: { ...f, is_capital: isCapital } });
      } else {
        await create.mutateAsync({ region_id: regionId, ...f, is_capital: isCapital });
      }
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={district ? t('geo_edit_district') : t('geo_new_district')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={pending}
      submitLabel={district ? t('q_save') : t('q_create')}
    >
      <NameFields f={f} set={set} />
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isCapital}
          onChange={(e) => setIsCapital(e.target.checked)}
          className="size-4 accent-primary"
        />
        {t('geo_is_capital')}
      </label>
    </ModalForm>
  );
}

// ── per-region card with its districts ───────────────────────────────────────
function RegionCard({ region, districts }: { region: Region; districts: District[] }) {
  const { t } = useTranslation();
  const delRegion = useDeleteRegion();
  const delDistrict = useDeleteDistrict();
  const [editRegion, setEditRegion] = useState(false);
  const [delRegionOpen, setDelRegionOpen] = useState(false);
  const [newDistrict, setNewDistrict] = useState(false);
  const [editDistrict, setEditDistrict] = useState<District | null>(null);
  const [delDistrictItem, setDelDistrictItem] = useState<District | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] bg-[#fbfcfe] px-[18px] py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[11px] bg-primary-tint text-primary">
            <MapPinIcon className="size-5" strokeWidth={1.8} />
          </div>
          <div className="grid gap-0.5">
            <span className="text-base font-semibold">{districtName(region)}</span>
            <Eyebrow className="text-slate-400">
              {t('geo_districts_n', { n: districts.length })}
            </Eyebrow>
          </div>
        </div>
        <div className="flex flex-wrap gap-[7px]">
          <Button
            variant="outline"
            size="sm"
            className="border-[#e2e8f0] text-[13px] font-medium text-slate-700"
            onClick={() => setNewDistrict(true)}
          >
            <PlusIcon />
            {t('geo_add_district')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-[#e2e8f0] text-slate-400 hover:text-primary"
            onClick={() => setEditRegion(true)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-[#e2e8f0] text-[#f43f5e] hover:bg-[#fff1f2] hover:text-[#e11d48]"
            onClick={() => setDelRegionOpen(true)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-[7px] p-4">
        {districts.length === 0 ? (
          <span className="px-1 py-2 text-sm text-muted-foreground">{t('geo_no_districts')}</span>
        ) : (
          districts.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2.5 rounded-[11px] border border-transparent bg-[#f8fafc] px-3.5 py-3 transition-colors hover:border-[#e2e8f0] hover:bg-[#f1f5f9]"
            >
              <div className="flex items-center gap-[9px]">
                <span className="text-sm font-medium">{districtName(d)}</span>
                {d.is_capital && (
                  <span className="rounded-full bg-primary-tint px-[9px] py-0.5 text-[11px] font-semibold text-primary">
                    {t('geo_is_capital')}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[30px] rounded-[7px] text-slate-400 hover:bg-white hover:text-primary"
                  onClick={() => setEditDistrict(d)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[30px] rounded-[7px] text-[#f43f5e] hover:bg-[#fff1f2] hover:text-[#e11d48]"
                  onClick={() => setDelDistrictItem(d)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {editRegion && <RegionModal region={region} onClose={() => setEditRegion(false)} />}
      {newDistrict && (
        <DistrictModal regionId={region.id} district={null} onClose={() => setNewDistrict(false)} />
      )}
      {editDistrict && (
        <DistrictModal
          regionId={region.id}
          district={editDistrict}
          onClose={() => setEditDistrict(null)}
        />
      )}
      {delRegionOpen && (
        <ModalForm
          title={t('geo_del_region_title')}
          onClose={() => setDelRegionOpen(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            await delRegion.mutateAsync(region.id);
            setDelRegionOpen(false);
          }}
          pending={delRegion.isPending}
          submitLabel={t('q_yes')}
          cancelLabel={t('q_no')}
        >
          <p className="text-sm">{t('geo_del_region_confirm', { name: districtName(region) })}</p>
        </ModalForm>
      )}
      {delDistrictItem && (
        <ModalForm
          title={t('geo_del_district_title')}
          onClose={() => setDelDistrictItem(null)}
          onSubmit={async (e) => {
            e.preventDefault();
            await delDistrict.mutateAsync(delDistrictItem.id);
            setDelDistrictItem(null);
          }}
          pending={delDistrict.isPending}
          submitLabel={t('q_yes')}
          cancelLabel={t('q_no')}
        >
          <p className="text-sm">
            {t('geo_del_district_confirm', { name: districtName(delDistrictItem) })}
          </p>
        </ModalForm>
      )}
    </div>
  );
}

// ── region picker: select + ‹ › steppers to page through regions ─────────────
function RegionPicker({
  regions,
  counts,
  value,
  onChange,
}: {
  regions: Region[];
  counts: Map<string, District[]>;
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const index = regions.findIndex((r) => r.id === value);

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border bg-card px-3.5 py-3">
      <Eyebrow className="pl-0.5 text-slate-400">{t('geo_region')}</Eyebrow>
      <Button
        variant="outline"
        size="icon"
        className="border-[#e2e8f0] text-slate-400"
        disabled={index <= 0}
        onClick={() => {
          const prev = regions[index - 1];
          if (prev) onChange(prev.id);
        }}
        aria-label={t('pg_prev')}
      >
        <ChevronLeftIcon />
      </Button>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {regions.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <span className="flex items-center gap-2">
                {districtName(r)}
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {t('geo_districts_n', { n: counts.get(r.id)?.length ?? 0 })}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="border-[#e2e8f0] text-slate-400"
        disabled={index >= regions.length - 1}
        onClick={() => {
          const next = regions[index + 1];
          if (next) onChange(next.id);
        }}
        aria-label={t('pg_next')}
      >
        <ChevronRightIcon />
      </Button>
      <span className="ml-auto text-[12.5px] text-slate-400 tabular-nums">
        {index + 1} / {regions.length}
      </span>
    </div>
  );
}

export function Geo() {
  const { t } = useTranslation();
  const { data: regions, isLoading } = useRegions();
  const { data: districts } = useDistricts();
  const [newRegion, setNewRegion] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const byRegion = useMemo(() => {
    const map = new Map<string, District[]>();
    for (const d of districts ?? []) {
      const arr = map.get(d.region_id) ?? [];
      arr.push(d);
      map.set(d.region_id, arr);
    }
    return map;
  }, [districts]);

  // Fall back to the first region until one is picked (or if the picked one is gone).
  const selected = regions?.find((r) => r.id === selectedId) ?? regions?.[0];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t('geo_subtitle')}</p>
        <Button onClick={() => setNewRegion(true)}>
          <PlusIcon />
          {t('geo_add_region')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : !regions?.length ? (
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t('geo_no_regions')}</p>
        </div>
      ) : (
        selected && (
          <>
            {regions.length > 1 && (
              <RegionPicker
                regions={regions}
                counts={byRegion}
                value={selected.id}
                onChange={setSelectedId}
              />
            )}
            <RegionCard
              key={selected.id}
              region={selected}
              districts={byRegion.get(selected.id) ?? []}
            />
          </>
        )
      )}

      {newRegion && <RegionModal region={null} onClose={() => setNewRegion(false)} />}
    </div>
  );
}
