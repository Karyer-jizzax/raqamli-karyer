import { type EventInput, type Material, useCreateEvent, useMaterials } from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import { Card, StatusPill } from '@karier/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import cam1Mp4 from '../assets/video/cam1.mp4';
import cam1Webm from '../assets/video/cam1.webm';
import cam2Mp4 from '../assets/video/cam2.mp4';
import cam2Webm from '../assets/video/cam2.webm';
import poster1 from '../assets/video/poster1.jpg';
import poster2 from '../assets/video/poster2.jpg';

// Animations + overlay/control bits that can't be expressed as inline styles
// (keyframes, pseudo-elements, focus rings). Injected once via a <style> tag.
const VIDEO_CSS = `
.vid-livedot{width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 0 0 rgba(192,70,60,.5);animation:vid-livep 1.6s infinite}
@keyframes vid-livep{0%{box-shadow:0 0 0 0 rgba(192,70,60,.5)}70%{box-shadow:0 0 0 7px rgba(192,70,60,0)}100%{box-shadow:0 0 0 0 rgba(192,70,60,0)}}
.vid-recdot i{width:9px;height:9px;border-radius:50%;background:#ff3b30;animation:vid-blink 1.1s infinite}
@keyframes vid-blink{50%{opacity:.25}}
.vid-bbox{position:absolute;border:3px solid #ff3b30;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.25);transition:left .15s linear}
.vid-readout::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.022) 0 1px,transparent 1px 3px);pointer-events:none}
.vid-params input,.vid-params select{width:100%;padding:8px 9px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:#fff;font-family:inherit}
.vid-params input:focus,.vid-params select:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,95,168,.13)}
.vid-btn{padding:10px 16px;border:none;border-radius:10px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;transition:transform .15s ease,box-shadow .15s ease,filter .15s ease}
.vid-btn:disabled{opacity:.65;cursor:default}
.vid-btn-go{background:linear-gradient(135deg,#1f9d6b,#15835a);color:#fff;box-shadow:0 3px 10px rgba(21,131,90,.3)}
.vid-btn-go:hover{filter:brightness(1.05)}
.vid-btn-g{background:#fff;border:1px solid var(--line);color:var(--brand)}
.vid-btn-g:hover{border-color:var(--brand)}
.vid-camtab{padding:7px 14px;border:1px solid var(--line);background:#fff;border-radius:9px;font-size:12.5px;cursor:pointer;font-weight:600;font-family:inherit}
.vid-camtab.on{background:var(--brand);color:#fff;border-color:var(--brand)}
@keyframes vid-toast-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@media(max-width:980px){.vid-grid{grid-template-columns:1fr !important}}
`;

// Fixed post/camera identity (demo, mirrors the reference HTML).
const POST = '0613-01';
const CAMERA = 'R-1-KA№1';

// Values the simulated AI "detects" when a vehicle passes (t ≥ 2s).
const DETECTED = {
  plate: '80 R 548 SA',
  model: 'HOWO SINOTRUK',
  direction: 'exit',
  density: '1.55',
  weight: '22900',
  length: '5.60',
  width: '2.30',
  height: '1.15',
  typeconf: '99.9',
};

// Owner identity attached to saved records (not edited in the video panel).
const OWNER = 'LATIPOV SHAROFIDDIN HAYO...';
const STIR = '31702851170041';
const PAYER = 'indiv';

const ICONS = {
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  camera:
    '<path d="M14 7H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="m16 11 4.553-2.276A1 1 0 0 1 22 9.618v4.764a1 1 0 0 1-1.447.894L16 13z"/><path d="M7 17v3"/><path d="M13 17v3"/>',
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
} as const;

function Icon({ name, size = 21 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

type Lang = ReturnType<typeof currentLang>;
function materialName(m: Material, lang: Lang): string {
  return lang === 'ru' ? m.name_ru : lang === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
}

interface Params {
  plate: string;
  model: string;
  direction: string;
  materialId: string;
  density: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  typeconf: string;
}

interface Computed {
  Vc: number | null;
  Vw: number;
  Vf: number;
  vConf: number;
  diff: number | null;
  rhoMeas: number;
  L: number;
  W: number;
  H: number;
  statKey: 'confirm' | 'flagged' | 'inspect';
  cls: 'ok' | 'warn' | 'bad';
  msgKey: string;
}

// Blend camera (L×W×H) and scale (weight÷density) volumes, derive a confidence
// and a confirm/flagged/inspect verdict. Mirrors the reference compute().
function compute(p: Params, mat: Material | undefined): Computed {
  const tent = !!mat?.is_tent;
  const rho = parseFloat(p.density) || 0;
  const wkg = parseFloat(p.weight) || 0;
  const wt = wkg / 1000;
  const L = parseFloat(p.length) || 0;
  const W = parseFloat(p.width) || 0;
  const H = parseFloat(p.height) || 0;
  const Vc = tent ? null : L * W * H;
  const Vw = rho > 0 ? wt / rho : 0;
  const camConf = tent ? 0 : 0.95;
  const scaleConf = rho > 0 ? 0.96 : 0;

  let Vf: number;
  let vConf: number;
  let diff: number | null = null;
  if (Vc !== null && Vc > 0 && Vw > 0) {
    diff = Math.abs(Vc - Vw) / ((Vc + Vw) / 2);
    const ag = Math.max(0, Math.min(1, 1 - diff / 0.08));
    Vf = (Vc * camConf + Vw * scaleConf) / (camConf + scaleConf);
    const base = Math.max(camConf, scaleConf);
    let c = base + ag * (1 - base) * 0.9;
    if (diff > 0.06) c *= Math.max(0.45, 1 - (diff - 0.06) / 0.2);
    vConf = Math.min(99.5, c * 100);
  } else {
    Vf = Vc || Vw;
    vConf = 90;
  }

  const rhoMeas = Vc && Vc > 0 ? wt / Vc : 0;
  const lo = mat ? mat.density_min : 0;
  const hi = mat ? mat.density_max : 9;
  const rhoOk = rhoMeas >= lo - 0.06 && rhoMeas <= hi + 0.06;

  let statKey: Computed['statKey'] = 'confirm';
  let cls: Computed['cls'] = 'ok';
  let msgKey = 'vid_flag_ok';
  if (tent) {
    cls = 'warn';
    msgKey = 'vid_flag_tent';
  } else if (diff !== null && diff > 0.12) {
    statKey = 'inspect';
    cls = 'bad';
    msgKey = 'vid_flag_inspect';
  } else if (diff !== null && diff > 0.06) {
    statKey = 'flagged';
    cls = 'warn';
    msgKey = 'vid_flag_avg';
  }
  if (!rhoOk && Vc && Vc > 0 && statKey === 'confirm') {
    statKey = 'flagged';
    cls = 'warn';
  }

  return { Vc, Vw, Vf, vConf, diff, rhoMeas, L, W, H, statKey, cls, msgKey };
}

function pickDefaultMaterial(materials: Material[]): Material | undefined {
  return (
    materials.find((m) => !m.is_tent && Math.abs(m.default_density - 1.55) < 0.001) ??
    materials.find((m) => !m.is_tent) ??
    materials[0]
  );
}

export function Video() {
  const { t } = useTranslation();
  const lang = currentLang();
  const { data: materials } = useMaterials();
  const createEvent = useCreateEvent();

  const videoRef = useRef<HTMLVideoElement>(null);
  const detRef = useRef(false);
  const analyzedRef = useRef(false);
  const savedAutoRef = useRef(false);

  const [cam, setCam] = useState<1 | 2>(1);
  const [started, setStarted] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [overlay, setOverlay] = useState({ bbox: false, plate: false, left: 52 });
  const [savedCount, setSavedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState<string | null>(null);

  const [params, setParams] = useState<Params>({
    plate: DETECTED.plate,
    model: DETECTED.model,
    direction: DETECTED.direction,
    materialId: '',
    density: DETECTED.density,
    weight: DETECTED.weight,
    length: DETECTED.length,
    width: DETECTED.width,
    height: DETECTED.height,
    typeconf: DETECTED.typeconf,
  });

  // Once materials load, default the selected material (qum-shag'al ≈ 1.55 t/m³).
  useEffect(() => {
    if (!materials?.length) return;
    setParams((p) => (p.materialId ? p : { ...p, materialId: pickDefaultMaterial(materials)?.id ?? '' }));
  }, [materials]);

  const selectedMaterial = materials?.find((m) => m.id === params.materialId);
  const c = useMemo(() => compute(params, selectedMaterial), [params, selectedMaterial]);

  const f2 = (n: number) => formatDecimal(n, lang);
  const f1 = (n: number) => {
    const s = n.toFixed(1);
    return lang === 'ru' ? s.replace('.', ',') : s;
  };

  const camMp4 = cam === 1 ? cam1Mp4 : cam2Mp4;
  const camWebm = cam === 1 ? cam1Webm : cam2Webm;
  const poster = cam === 1 ? poster1 : poster2;

  // Reload + play when the camera source changes.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    if (started) v.play().catch(() => {});
  }, [cam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attempt muted autoplay on mount; hide the start overlay if it succeeds,
  // otherwise leave the overlay so the user can start playback manually.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().then(() => setStarted(true)).catch(() => {});
  }, []);

  // Auto-clear the toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  function buildPayload(): EventInput | null {
    const mat = selectedMaterial ?? (materials ? pickDefaultMaterial(materials) : undefined);
    if (!mat) return null;
    const parts = params.plate.trim().split(/\s+/);
    return {
      plate_region: parts[0] || '80',
      plate_number: parts.slice(1).join(' ') || '000 AA',
      model: params.model,
      direction: params.direction,
      payer_type: PAYER,
      material_id: mat.id,
      density: parseFloat(params.density) || mat.default_density,
      weight_kg: parseFloat(params.weight) || 0,
      length_m: parseFloat(params.length) || 0,
      width_m: parseFloat(params.width) || 0,
      height_m: parseFloat(params.height) || 0,
      owner_name: OWNER,
      stir: STIR,
    };
  }

  function autoSave() {
    const payload = buildPayload();
    if (!payload) return;
    createEvent.mutate(payload, {
      onSuccess: () => {
        setSavedCount((n) => n + 1);
        setToast(t('vid_toast_saved'));
      },
    });
  }

  function manualSave() {
    const payload = buildPayload();
    if (!payload) return;
    createEvent.mutate(payload, {
      onSuccess: () => {
        setSavedCount((n) => n + 1);
        setSaveLabel(t('vid_saved_ok'));
        setTimeout(() => setSaveLabel(null), 1200);
      },
    });
  }

  function startVid() {
    setStarted(true);
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }

  function resetDetect() {
    detRef.current = false;
    savedAutoRef.current = false;
    analyzedRef.current = false;
    setAnalyzed(false);
    setOverlay({ bbox: false, plate: false, left: 52 });
    setParams((p) => ({
      ...p,
      plate: DETECTED.plate,
      model: DETECTED.model,
      direction: DETECTED.direction,
      density: DETECTED.density,
      weight: DETECTED.weight,
      length: DETECTED.length,
      width: DETECTED.width,
      height: DETECTED.height,
      typeconf: DETECTED.typeconf,
    }));
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    setStarted(true);
  }

  // Drive the simulated detection off playback time.
  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    const tt = v.currentTime || 0;
    if (tt < 1.6) {
      detRef.current = false;
      if (tt < 0.6) setOverlay((o) => ({ ...o, bbox: false, plate: false }));
    }
    if (detRef.current) {
      setOverlay((o) => ({ ...o, left: 52 + Math.min(6, (tt - 2) * 1.2) }));
      return;
    }
    if (tt >= 2.0) {
      detRef.current = true;
      setOverlay({ bbox: true, plate: true, left: 52 });
      if (!analyzedRef.current) {
        analyzedRef.current = true;
        setAnalyzed(true);
      }
      if (!savedAutoRef.current) {
        savedAutoRef.current = true;
        autoSave();
      }
    }
  }

  const set = (k: keyof Params) => (v: string) => setParams((p) => ({ ...p, [k]: v }));
  const onMaterialChange = (id: string) =>
    setParams((p) => {
      const m = materials?.find((x) => x.id === id);
      return { ...p, materialId: id, density: m && !m.is_tent ? String(m.default_density) : p.density };
    });

  return (
    <div style={{ padding: 24 }}>
      <style>{VIDEO_CSS}</style>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px', color: '#15273c' }}>{t('vid_title')}</h1>
        <div style={{ fontSize: 13, color: 'var(--muted-ink)' }}>{t('vid_sub')}</div>
      </div>

      {/* Stats */}
      <div className="vid-stats" style={STATS_GRID}>
        <Stat icon="pin" label={t('vid_stat_post')} value={POST} />
        <Stat icon="camera" label={t('vid_stat_cam')} value={CAMERA} />
        <Stat icon="activity" label={t('vid_stat_ai')} value={t('vid_stat_on')} ok />
        <Stat icon="truck" label={t('vid_stat_detected')} value={String(savedCount)} />
      </div>

      <div className="vid-grid" style={GRID}>
        {/* Left: video + controls */}
        <div>
          <div style={CARD}>
            <div style={CARD_HEAD}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#22384e' }}>
                <span style={CHIP_IC}>
                  <Icon name="camera" size={16} />
                </span>
                <b style={{ fontWeight: 800 }}>{CAMERA}</b>
                <span style={{ color: 'var(--line)' }}>·</span>
                <span style={{ color: 'var(--muted-ink)' }}>{t('vid_stream')}</span>
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: 'var(--red)',
                  letterSpacing: 0.6,
                }}
              >
                <i className="vid-livedot" />
                LIVE
              </span>
            </div>

            <div style={STAGE}>
              <video
                ref={videoRef}
                poster={poster}
                muted
                loop
                autoPlay
                playsInline
                preload="auto"
                style={{ width: '100%', display: 'block' }}
                onTimeUpdate={onTimeUpdate}
                onClick={() => {
                  const v = videoRef.current;
                  if (v) {
                    v.muted = true;
                    v.play().catch(() => {});
                  }
                }}
              >
                <source src={camMp4} type="video/mp4" />
                <source src={camWebm} type="video/webm" />
              </video>

              <div style={TS}>10-02-2026 Tue 17:01:46</div>
              <div className="vid-recdot" style={RECDOT}>
                <i />
                REC
              </div>
              <div style={CV}>CVideo#2</div>

              {overlay.bbox && (
                <div
                  className="vid-bbox"
                  style={{ left: `${overlay.left}%`, top: '22%', width: '13%', height: '20%' }}
                >
                  <span style={{ ...LAB, top: 0, right: 0, transform: 'translateY(-100%)' }}>
                    {t('vid_ai_load')} (97.38%)
                  </span>
                  <span style={{ ...LAB, bottom: 0, right: 0, transform: 'translateY(100%)' }}>
                    {selectedMaterial ? selectedMaterial.name_uz_latn : ''} (99.90%)
                  </span>
                </div>
              )}
              {overlay.plate && <div style={PLATE_OV}>•{params.plate}</div>}

              {!started && (
                <div style={START_OV} onClick={startVid}>
                  <button style={START_BTN}>{t('vid_start')}</button>
                </div>
              )}
            </div>
          </div>

          <div style={CTRLROW}>
            <button className="vid-btn vid-btn-go" onClick={startVid}>
              {t('vid_start')}
            </button>
            <button className="vid-btn vid-btn-g" onClick={resetDetect}>
              {t('vid_reanalyze')}
            </button>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button className={`vid-camtab${cam === 1 ? ' on' : ''}`} onClick={() => setCam(1)}>
                {t('vid_cam1')}
              </button>
              <button className={`vid-camtab${cam === 2 ? ' on' : ''}`} onClick={() => setCam(2)}>
                {t('vid_cam2')}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-ink)' }}>{t('vid_hint')}</div>
        </div>

        {/* Right: analysis result */}
        <Card>
          <h3 style={PANEL_H}>
            <span style={PANEL_IC}>
              <Icon name="activity" size={18} />
            </span>
            {t('vid_res_title')}
          </h3>

          {!analyzed ? (
            <div style={RES_EMPTY}>
              <div style={RES_EMPTY_IC}>
                <Icon name="camera" size={30} />
              </div>
              <p style={{ margin: 0, maxWidth: 240, lineHeight: 1.5 }}>{t('vid_res_waiting')}</p>
            </div>
          ) : (
            <>
              <div className="vid-readout" style={READOUT}>
                <div style={READOUT_LAB}>{t('vid_volume')}</div>
                <div>
                  <span style={READOUT_NUM}>{f2(c.Vf)}</span>{' '}
                  <span style={{ fontSize: 18, color: '#1d6b4d', fontWeight: 700 }}>{t('vid_unit')}</span>
                </div>
                <div style={READOUT_CONF}>
                  {t('vid_confidence')}: <b style={{ color: '#3df0a6' }}>{f1(c.vConf)}%</b>
                  <span style={{ marginLeft: 8 }}>
                    <StatusPill status={c.statKey} />
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted-ink)', marginBottom: 6 }}>
                {t('vid_detected_edit')}
              </div>

              <div className="vid-params" style={PARAMS}>
                <Field label={t('vid_f_plate')}>
                  <input value={params.plate} onChange={(e) => set('plate')(e.target.value)} />
                </Field>
                <Field label={t('vid_f_model')}>
                  <input value={params.model} onChange={(e) => set('model')(e.target.value)} />
                </Field>
                <Field label={t('vid_f_dir')}>
                  <select value={params.direction} onChange={(e) => set('direction')(e.target.value)}>
                    <option value="exit">{t('dir_exit')}</option>
                    <option value="enter">{t('dir_enter')}</option>
                  </select>
                </Field>
                <Field label={t('vid_f_material')}>
                  <select value={params.materialId} onChange={(e) => onMaterialChange(e.target.value)}>
                    {(materials ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {materialName(m, lang)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('vid_f_density')}>
                  <input type="number" step="0.01" value={params.density} onChange={(e) => set('density')(e.target.value)} />
                </Field>
                <Field label={t('vid_f_weight')}>
                  <input type="number" value={params.weight} onChange={(e) => set('weight')(e.target.value)} />
                </Field>
                <Field label={t('vid_f_len')}>
                  <input type="number" step="0.01" value={params.length} onChange={(e) => set('length')(e.target.value)} />
                </Field>
                <Field label={t('vid_f_wid')}>
                  <input type="number" step="0.01" value={params.width} onChange={(e) => set('width')(e.target.value)} />
                </Field>
                <Field label={t('vid_f_hei')}>
                  <input type="number" step="0.01" value={params.height} onChange={(e) => set('height')(e.target.value)} />
                </Field>
                <Field label={t('vid_f_typeconf')}>
                  <input type="number" step="0.1" value={params.typeconf} onChange={(e) => set('typeconf')(e.target.value)} />
                </Field>
              </div>

              <div style={CROWS}>
                <Crow
                  label={`${t('vid_row_cam')}${c.Vc !== null ? ` (${f2(c.L)}×${f2(c.W)}×${f2(c.H)})` : ''}`}
                  value={c.Vc === null ? '-' : `${f2(c.Vc)} ${t('vid_unit')}`}
                />
                <Crow label={t('vid_row_scale')} value={`${f2(c.Vw)} ${t('vid_unit')}`} />
                {c.diff !== null && <Crow label={t('vid_row_diff')} value={`${f1(c.diff * 100)}%`} />}
                <Crow label={t('vid_row_dcheck')} value={`${f2(c.rhoMeas)} t/m³`} />
                <Crow label={t('vid_final_vol')} value={`${f2(c.Vf)} ${t('vid_unit')} · ${f1(c.vConf)}%`} total />
              </div>

              <div style={{ ...FLAG, ...FLAG_CLS[c.cls] }}>{t(c.msgKey)}</div>

              <button
                className="vid-btn vid-btn-go"
                style={{ width: '100%', marginTop: 13 }}
                onClick={manualSave}
                disabled={createEvent.isPending}
              >
                {saveLabel ?? t('vid_save')}
              </button>
            </>
          )}
        </Card>
      </div>

      {toast && <div style={TOAST}>{toast}</div>}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  ok,
}: {
  icon: keyof typeof ICONS;
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div style={STAT}>
      <div style={{ ...STAT_IC, ...(ok ? { background: 'var(--green-l)', color: 'var(--green)' } : null) }}>
        <Icon name={icon} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <span style={{ fontSize: 11.5, color: 'var(--muted-ink)', fontWeight: 600 }}>{label}</span>
        <b
          style={{
            fontSize: 16,
            color: ok ? 'var(--green)' : '#15273c',
            fontFamily: ok ? 'var(--sans)' : 'var(--mono)',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </b>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--muted-ink)', display: 'block', marginBottom: 3, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Crow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        padding: '9px 12px',
        borderBottom: '1px solid var(--line)',
        fontSize: 13,
        ...(total ? { background: '#eef5fc', fontWeight: 800 } : null),
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: 'var(--mono)' }}>{value}</span>
    </div>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const STATS_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
  gap: 12,
  marginBottom: 16,
};
const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' };
const STAT: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 13,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 13,
  padding: '13px 15px',
  boxShadow: 'var(--sh)',
};
const STAT_IC: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 11,
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  background: '#e8edf4',
  color: 'var(--brand)',
};
const CARD: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: 'var(--sh)',
};
const CARD_HEAD: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 15px',
  borderBottom: '1px solid var(--line)',
  background: 'linear-gradient(180deg,#fbfdff,#f4f7fb)',
};
const CHIP_IC: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  background: '#e8edf4',
  color: 'var(--brand)',
  display: 'grid',
  placeItems: 'center',
};
const STAGE: React.CSSProperties = { position: 'relative', background: '#000' };
const TS: React.CSSProperties = {
  position: 'absolute',
  top: 9,
  left: 13,
  fontFamily: 'var(--mono)',
  fontSize: 13,
  color: '#eafaf2',
  textShadow: '0 1px 3px #000',
};
const RECDOT: React.CSSProperties = {
  position: 'absolute',
  top: 9,
  right: 14,
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: '#ff6a5e',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  textShadow: '0 1px 3px #000',
};
const CV: React.CSSProperties = {
  position: 'absolute',
  bottom: 11,
  right: 14,
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: '#dfeee6',
  textShadow: '0 1px 3px #000',
};
const LAB: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(17,17,17,.78)',
  color: '#fff',
  fontFamily: 'var(--mono)',
  fontSize: 12.5,
  padding: '2px 8px',
  whiteSpace: 'nowrap',
  borderRadius: 3,
};
const PLATE_OV: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 11,
  background: '#fff',
  border: '2px solid #2b2b2b',
  borderRadius: 5,
  padding: '2px 9px',
  fontFamily: 'var(--mono)',
  fontWeight: 700,
};
const START_OV: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(7,13,20,.5)',
  cursor: 'pointer',
  backdropFilter: 'blur(1px)',
};
const START_BTN: React.CSSProperties = {
  fontSize: 15,
  padding: '13px 24px',
  borderRadius: 11,
  border: 'none',
  background: 'linear-gradient(135deg,#1f9d6b,#15835a)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 8px 22px rgba(0,0,0,.3)',
};
const CTRLROW: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  margin: '13px 0',
  flexWrap: 'wrap',
};
const PANEL_H: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  margin: '0 0 14px',
  fontSize: 15,
  fontWeight: 800,
  color: '#15273c',
};
const PANEL_IC: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  background: '#e8edf4',
  color: 'var(--brand)',
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
};
const RES_EMPTY: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 14,
  padding: '38px 18px',
  color: 'var(--muted-ink)',
};
const RES_EMPTY_IC: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 18,
  background: 'linear-gradient(180deg,#eef2f8,#e3e9f2)',
  color: 'var(--brand)',
  display: 'grid',
  placeItems: 'center',
};
const READOUT: React.CSSProperties = {
  background: '#0b1622',
  borderRadius: 13,
  padding: 18,
  marginBottom: 14,
  position: 'relative',
  overflow: 'hidden',
};
const READOUT_LAB: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: 2,
  color: '#5f8576',
  textTransform: 'uppercase',
};
const READOUT_NUM: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontWeight: 700,
  fontSize: 46,
  color: '#3df0a6',
  lineHeight: 1,
  textShadow: '0 0 16px rgba(61,240,166,.4)',
};
const READOUT_CONF: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  color: '#cfe9dd',
  fontSize: 13,
  marginTop: 9,
  display: 'flex',
  alignItems: 'center',
};
const PARAMS: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 4,
};
const CROWS: React.CSSProperties = {
  marginTop: 13,
  border: '1px solid var(--line)',
  borderRadius: 10,
  overflow: 'hidden',
};
const FLAG: React.CSSProperties = { marginTop: 11, padding: '10px 13px', borderRadius: 9, fontSize: 12.5 };
const FLAG_CLS: Record<Computed['cls'], React.CSSProperties> = {
  ok: { background: 'var(--green-l)', color: '#14704a' },
  warn: { background: 'var(--amber-l)', color: '#79530f' },
  bad: { background: 'var(--red-l)', color: '#7c2a23' },
};
const TOAST: React.CSSProperties = {
  position: 'fixed',
  bottom: 18,
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#1f9d6b',
  color: '#fff',
  padding: '11px 18px',
  borderRadius: 10,
  fontWeight: 700,
  zIndex: 99,
  boxShadow: '0 8px 24px rgba(0,0,0,.22)',
  maxWidth: '92vw',
  textAlign: 'center',
  animation: 'vid-toast-in .2s ease',
};
