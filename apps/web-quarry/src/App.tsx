import {
  ApiError,
  analyzeFrame,
  type EventInput,
  ingestFrame,
  useCreateEvent,
  useEvents,
  useMaterials,
} from '@karier/api-client';
import { computeVolume } from '@karier/calc';
import { currentLang, useTranslation } from '@karier/i18n';
import { Button, Card, LangSwitcher, ProfileMenu, ProtocolViewer, RequireAuth, StatusPill } from '@karier/ui';
import type { StatusKey } from '@karier/types';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useRef, useState } from 'react';

const num = (s: string) => Number(s) || 0;

function RegisterForm() {
  const { t } = useTranslation();
  const { data: materials } = useMaterials();
  const create = useCreateEvent();

  const [f, setF] = useState({
    plate_region: '80',
    plate_number: 'R 548 SA',
    model: 'HOWO SINOTRUK',
    material_id: 'qumshagal',
    weight_kg: '87400',
    density: '1.55',
    length_m: '5.64',
    width_m: '2.5',
    height_m: '4.0',
    owner_name: '',
    stir: '',
  });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // ── AI video stage ────────────────────────────────────────────────────────
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [bbox, setBbox] = useState<number[] | null>(null);
  const [detLabel, setDetLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f0 = e.target.files?.[0] ?? null;
    setFile(f0);
    setImageUrl(f0 ? URL.createObjectURL(f0) : null);
    setBbox(null);
    setDetLabel(null);
  }

  async function onAnalyze() {
    setBusy(true);
    setErr('');
    try {
      const { detection: d } = await analyzeFrame(file);
      setBbox(d.bbox);
      setDetLabel(`${d.plate_region} ${d.plate_number} · ${d.plate_confidence}%`);
      setF((p) => ({
        ...p,
        plate_region: d.plate_region,
        plate_number: d.plate_number,
        model: d.model,
        material_id: d.material_id,
        weight_kg: String(d.weight_kg),
        density: String(d.density),
        length_m: String(d.length_m),
        width_m: String(d.width_m),
        height_m: String(d.height_m),
      }));
    } catch {
      setErr('AI tahlil xatosi');
    } finally {
      setBusy(false);
    }
  }

  async function onIngest() {
    setBusy(true);
    setErr('');
    try {
      await ingestFrame(file);
      await qc.invalidateQueries({ queryKey: ['events'] });
    } catch {
      setErr('Ingest xatosi');
    } finally {
      setBusy(false);
    }
  }

  // Live operator-side preview (authoritative recompute happens on the backend).
  const preview = useMemo(
    () =>
      computeVolume({
        materialId: f.material_id,
        density: num(f.density),
        weightKg: num(f.weight_kg),
        lengthM: num(f.length_m),
        widthM: num(f.width_m),
        heightM: num(f.height_m),
      }),
    [f],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const body: EventInput = {
      plate_region: f.plate_region,
      plate_number: f.plate_number,
      model: f.model,
      direction: 'exit',
      payer_type: 'indiv',
      material_id: f.material_id,
      density: num(f.density),
      weight_kg: num(f.weight_kg),
      length_m: num(f.length_m),
      width_m: num(f.width_m),
      height_m: num(f.height_m),
      owner_name: f.owner_name,
      stir: f.stir,
    };
    try {
      await create.mutateAsync(body);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <Card>
      <h3 style={{ margin: '0 0 12px' }}>{t('nav_video')}</h3>

      {/* AI stage: image + bbox overlay */}
      <div
        style={{
          position: 'relative',
          background: '#0b1622',
          borderRadius: 12,
          overflow: 'hidden',
          aspectRatio: '16 / 10',
          display: 'grid',
          placeItems: 'center',
          marginBottom: 10,
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#6b8299', fontSize: 12.5, padding: 16, textAlign: 'center' }}>
            {t('vid_no_image')}
          </span>
        )}
        {bbox && (
          <div
            style={{
              position: 'absolute',
              left: `${bbox[0]! * 100}%`,
              top: `${bbox[1]! * 100}%`,
              width: `${bbox[2]! * 100}%`,
              height: `${bbox[3]! * 100}%`,
              border: '3px solid #ff3b30',
              borderRadius: 3,
              boxShadow: '0 0 0 1px rgba(0,0,0,.3)',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -22,
                left: 0,
                background: '#ff3b30',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {detLabel}
            </span>
          </div>
        )}
        <span style={{ position: 'absolute', top: 8, right: 12, color: '#ff6a5e', fontSize: 11, fontWeight: 700 }}>
          ● REC
        </span>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          {t('vid_upload')}
        </Button>
        <Button onClick={onAnalyze} disabled={busy}>
          {busy ? t('vid_analyzing') : t('vid_analyze')}
        </Button>
        <Button variant="ghost" onClick={onIngest} disabled={busy}>
          {t('vid_autosave')}
        </Button>
      </div>

      <h3 style={{ margin: '4px 0 12px' }}>{t('ev_register')}</h3>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8 }}>
          <F label={t('ev_plate_region')} value={f.plate_region} onChange={set('plate_region')} />
          <F label={t('ev_plate_number')} value={f.plate_number} onChange={set('plate_number')} />
        </div>
        <F label={t('ev_model')} value={f.model} onChange={set('model')} />
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          {t('ev_material')}
          <select
            value={f.material_id}
            onChange={(e) => set('material_id')(e.target.value)}
            style={inp}
          >
            {materials?.map((m) => {
              const l = currentLang();
              const name = l === 'ru' ? m.name_ru : l === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
              return (
                <option key={m.id} value={m.id}>
                  {name}
                </option>
              );
            })}
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <F label={t('ev_weight')} value={f.weight_kg} onChange={set('weight_kg')} mono />
          <F label={t('ev_density')} value={f.density} onChange={set('density')} mono />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <F label="L (m)" value={f.length_m} onChange={set('length_m')} mono />
          <F label="W (m)" value={f.width_m} onChange={set('width_m')} mono />
          <F label="H (m)" value={f.height_m} onChange={set('height_m')} mono />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <F label={t('ev_owner')} value={f.owner_name} onChange={set('owner_name')} />
          <F label={t('ev_stir')} value={f.stir} onChange={set('stir')} mono />
        </div>

        <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{t('ev_preview')}</div>
          <div style={{ display: 'grid', gap: 5 }}>
            <Row k="Vc" v={`${preview.volumeCamera ?? '—'} m³`} />
            <Row k="Vw" v={`${preview.volumeScale} m³`} />
            <Row k={t('ev_vol_final')} v={`${preview.volumeFinal} m³`} />
            <Row k={t('ev_conf')} v={`${preview.confidence}%`} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)' }}>{t('q_status')}</span>
              <StatusPill status={preview.status} />
            </div>
          </div>
        </div>

        {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        <Button type="submit" disabled={create.isPending}>
          {t('ev_save')}
        </Button>
      </form>
    </Card>
  );
}

function EventList() {
  const { t } = useTranslation();
  const { data: events, isLoading } = useEvents();
  const [protoEvent, setProtoEvent] = useState<string | null>(null);

  if (isLoading) return <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>;
  if (!events?.length) return <p style={{ color: 'var(--muted)' }}>{t('ev_empty')}</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      {protoEvent && <ProtocolViewer eventId={protoEvent} onClose={() => setProtoEvent(null)} />}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11 }}>
            <th style={th}>{t('ev_plate_number')}</th>
            <th style={th}>{t('ev_model')}</th>
            <th style={th}>{t('ev_vol_final')}</th>
            <th style={th}>{t('ev_conf')}</th>
            <th style={th}>{t('q_status')}</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ ...td, fontFamily: 'var(--mono)' }}>
                {e.plate_region} {e.plate_number}
              </td>
              <td style={td}>{e.model}</td>
              <td style={{ ...td, fontFamily: 'var(--mono)' }}>{e.volume_final} m³</td>
              <td style={{ ...td, fontFamily: 'var(--mono)' }}>{e.volume_confidence}%</td>
              <td style={td}>
                <StatusPill status={e.status as StatusKey} />
              </td>
              <td style={td}>
                <Button variant="ghost" onClick={() => setProtoEvent(e.id)}>
                  {t('protocol_open')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Shell() {
  const { t } = useTranslation();
  return (
    <div>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '11px 24px',
          background: '#fff',
          borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: 16, color: 'var(--brand)' }}>{t('app_quarry')}</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <LangSwitcher />
          <ProfileMenu />
        </div>
      </header>

      <div
        style={{
          padding: 24,
          display: 'grid',
          gap: 20,
          gridTemplateColumns: '380px 1fr',
          alignItems: 'start',
          maxWidth: 1200,
        }}
      >
        <RegisterForm />
        <div>
          <h2 style={{ margin: '0 0 12px' }}>{t('ev_list')}</h2>
          <Card>
            <EventList />
          </Card>
        </div>
      </div>
    </div>
  );
}

function F({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  mono?: boolean;
}) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inp, fontFamily: mono ? 'var(--mono)' : 'inherit' }}
      />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <b style={{ fontFamily: 'var(--mono)' }}>{v}</b>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: '9px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  width: '100%',
};
const th: React.CSSProperties = { padding: '6px 10px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '9px 10px' };

export function App() {
  return (
    <RequireAuth allowedRoles={['operator', 'superadmin']} appKey="app_quarry" accent="#c0671f">
      <Shell />
    </RequireAuth>
  );
}
