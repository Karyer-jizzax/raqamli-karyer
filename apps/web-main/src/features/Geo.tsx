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
import { Button, Card } from '@karier/ui';
import { type FormEvent, useMemo, useState } from 'react';

import { districtName, Field, Modal } from '../shared';

type NameForm = { code: string; name_uz_latn: string; name_uz_cyrl: string; name_ru: string };

const emptyNames: NameForm = { code: '', name_uz_latn: '', name_uz_cyrl: '', name_ru: '' };

function NameFields({ f, set }: { f: NameForm; set: (k: keyof NameForm) => (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Field label={t('geo_name_latn')} value={f.name_uz_latn} onChange={set('name_uz_latn')} />
      <Field label={t('geo_name_cyrl')} value={f.name_uz_cyrl} onChange={set('name_uz_cyrl')} />
      <Field label={t('geo_name_ru')} value={f.name_ru} onChange={set('name_ru')} />
      <Field label={t('geo_code')} value={f.code} onChange={set('code')} autoComplete="off" />
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
          code: region.code,
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
    <Modal title={region ? t('geo_edit_region') : t('geo_new_region')} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <NameFields f={f} set={set} />
        {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t('q_cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {region ? t('q_save') : t('q_create')}
          </Button>
        </div>
      </form>
    </Modal>
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
          code: district.code,
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
    <Modal title={district ? t('geo_edit_district') : t('geo_new_district')} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <NameFields f={f} set={set} />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={isCapital}
            onChange={(e) => setIsCapital(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          {t('geo_is_capital')}
        </label>
        {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t('q_cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {district ? t('q_save') : t('q_create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── delete confirm (shared for region + district) ────────────────────────────
function ConfirmModal({
  title,
  message,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  pending: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [err, setErr] = useState('');
  async function run() {
    setErr('');
    try {
      await onConfirm();
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ margin: '0 0 16px', fontSize: 14 }}>{message}</p>
      {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          {t('q_no')}
        </Button>
        <Button onClick={run} disabled={pending}>
          {t('q_yes')}
        </Button>
      </div>
    </Modal>
  );
}

// ── per-region card with its districts ───────────────────────────────────────
function RegionCard({
  region,
  districts,
}: {
  region: Region;
  districts: District[];
}) {
  const { t } = useTranslation();
  const delRegion = useDeleteRegion();
  const delDistrict = useDeleteDistrict();
  const [editRegion, setEditRegion] = useState(false);
  const [delRegionOpen, setDelRegionOpen] = useState(false);
  const [newDistrict, setNewDistrict] = useState(false);
  const [editDistrict, setEditDistrict] = useState<District | null>(null);
  const [delDistrictItem, setDelDistrictItem] = useState<District | null>(null);

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 16 }}>{districtName(region)}</b>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>
              {region.code}
            </span>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
            {t('geo_districts_n', { n: districts.length })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => setNewDistrict(true)}>
            + {t('geo_add_district')}
          </Button>
          <Button variant="ghost" onClick={() => setEditRegion(true)}>
            {t('q_edit')}
          </Button>
          <Button variant="ghost" onClick={() => setDelRegionOpen(true)}>
            {t('q_delete')}
          </Button>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          borderTop: '1px solid var(--line)',
          paddingTop: 12,
          display: 'grid',
          gap: 6,
        }}
      >
        {districts.length === 0 ? (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t('geo_no_districts')}</span>
        ) : (
          districts.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '7px 10px',
                background: 'var(--soft)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{districtName(d)}</span>
                {d.is_capital && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--brand)',
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: 999,
                      padding: '1px 7px',
                    }}
                  >
                    {t('geo_is_capital')}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 11.5 }}>
                  {d.code}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Button variant="ghost" onClick={() => setEditDistrict(d)}>
                  {t('q_edit')}
                </Button>
                <Button variant="ghost" onClick={() => setDelDistrictItem(d)}>
                  {t('q_delete')}
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
        <ConfirmModal
          title={t('geo_del_region_title')}
          message={t('geo_del_region_confirm', { name: districtName(region) })}
          pending={delRegion.isPending}
          onConfirm={() => delRegion.mutateAsync(region.id)}
          onClose={() => setDelRegionOpen(false)}
        />
      )}
      {delDistrictItem && (
        <ConfirmModal
          title={t('geo_del_district_title')}
          message={t('geo_del_district_confirm', { name: districtName(delDistrictItem) })}
          pending={delDistrict.isPending}
          onConfirm={() => delDistrict.mutateAsync(delDistrictItem.id)}
          onClose={() => setDelDistrictItem(null)}
        />
      )}
    </Card>
  );
}

export function Geo() {
  const { t } = useTranslation();
  const { data: regions, isLoading } = useRegions();
  const { data: districts } = useDistricts();
  const [newRegion, setNewRegion] = useState(false);

  const byRegion = useMemo(() => {
    const map = new Map<string, District[]>();
    for (const d of districts ?? []) {
      const arr = map.get(d.region_id) ?? [];
      arr.push(d);
      map.set(d.region_id, arr);
    }
    return map;
  }, [districts]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 2px', fontSize: 22 }}>{t('nav_geo')}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>{t('geo_subtitle')}</p>
        </div>
        <Button onClick={() => setNewRegion(true)}>+ {t('geo_add_region')}</Button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>
      ) : !regions?.length ? (
        <Card>
          <p style={{ color: 'var(--muted)', margin: 0 }}>{t('geo_no_regions')}</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {regions.map((r) => (
            <RegionCard key={r.id} region={r} districts={byRegion.get(r.id) ?? []} />
          ))}
        </div>
      )}

      {newRegion && <RegionModal region={null} onClose={() => setNewRegion(false)} />}
    </div>
  );
}
