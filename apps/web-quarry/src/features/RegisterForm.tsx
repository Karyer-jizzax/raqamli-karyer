import {
  ApiError,
  type EventInput,
  useCreateEvent,
  useMaterials,
  usePostCameras,
  useQuarryPosts,
  useScaleReading,
} from '@karier/api-client';
import { computeVolume } from '@karier/calc';
import { currentLang, useTranslation } from '@karier/i18n';
import { Button, Card, cn, Input, StatusPill, useAuth } from '@karier/ui';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { AiStage } from './AiStage';

const num = (s: string) => Number(s) || 0;

export type EventForm = {
  plate_region: string;
  plate_number: string;
  model: string;
  material_id: string;
  weight_kg: string;
  density: string;
  owner_name: string;
  stir: string;
};

const selectCls =
  'w-full cursor-pointer appearance-none rounded-[11px] border border-input bg-white pr-9 pl-3.5 text-[15.5px] text-foreground outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-tint';

function Chevron() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#94a3b8"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function F({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] text-slate-500">
      {label}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-12 rounded-[11px] text-[15.5px] text-foreground md:text-[15.5px]',
          numeric && 'tabular-nums',
        )}
      />
    </label>
  );
}

export function RegisterForm() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: materials } = useMaterials();
  const { data: posts } = useQuarryPosts(user?.quarry_id ?? undefined);
  const create = useCreateEvent();
  const scaleReading = useScaleReading();

  // Which physical post/camera this operator is capturing from — attributed
  // on both the manual save and the AI autosave, instead of the server's
  // "first post" fallback.
  const [postId, setPostId] = useState('');
  useEffect(() => {
    if (posts?.length && !posts.some((p) => p.id === postId)) setPostId(posts[0]!.id);
  }, [posts, postId]);
  const { data: cameras } = usePostCameras(postId || undefined);
  const camera = cameras?.find((c) => c.kind === 'plate' && c.is_active) ?? cameras?.[0];

  const [f, setF] = useState<EventForm>({
    plate_region: '80',
    plate_number: 'R 548 SA',
    model: 'HOWO SINOTRUK',
    material_id: 'qumshagal',
    weight_kg: '',
    density: '1.55',
    owner_name: '',
    stir: '',
  });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function onFetchScale() {
    setErr('');
    try {
      const reading = await scaleReading.mutateAsync({
        plateRegion: f.plate_region,
        plateNumber: f.plate_number,
      });
      set('weight_kg')(String(reading.weight_kg));
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Tarozi xatosi');
    }
  }

  // Live operator-side preview (authoritative recompute happens on the backend).
  const preview = useMemo(
    () =>
      computeVolume({
        materialId: f.material_id,
        density: num(f.density),
        weightKg: num(f.weight_kg),
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
      owner_name: f.owner_name,
      stir: f.stir,
      post_id: postId || undefined,
      camera_id: camera?.id,
    };
    try {
      await create.mutateAsync(body);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <Card className="rounded-[18px] p-[22px]">
      <h2 className="mb-3.5 text-[19px] font-semibold">{t('nav_video')}</h2>

      {posts && posts.length > 0 && (
        <div className="mb-3.5 flex flex-wrap items-end gap-3.5">
          <label className="flex flex-col gap-[5px] text-[13px] text-slate-500">
            {t('vid_stat_post')}
            <span className="relative">
              <select
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                className={cn(selectCls, 'h-10 min-w-[150px] rounded-[10px] text-[14.5px]')}
              >
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Chevron />
            </span>
          </label>
          <span className="pb-2.5 text-[13.5px] text-slate-500">
            {t('vid_stat_cam')}:{' '}
            <b className="font-semibold text-slate-700">
              {camera ? camera.name : t('camera_empty')}
            </b>
          </span>
        </div>
      )}

      <AiStage postId={postId} cameraId={camera?.id} setF={setF} setErr={setErr} />

      <h2 className="mb-3.5 text-[19px] font-semibold">{t('ev_register')}</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-[13px]">
        <div className="grid grid-cols-[96px_1fr] gap-2.5">
          <F label={t('ev_plate_region')} value={f.plate_region} onChange={set('plate_region')} numeric />
          <F label={t('ev_plate_number')} value={f.plate_number} onChange={set('plate_number')} />
        </div>
        <F label={t('ev_model')} value={f.model} onChange={set('model')} />
        <label className="flex flex-col gap-1.5 text-[13px] text-slate-500">
          {t('ev_material')}
          <span className="relative">
            <select
              value={f.material_id}
              onChange={(e) => set('material_id')(e.target.value)}
              className={cn(selectCls, 'h-12')}
            >
              {materials?.map((m) => {
                const l = currentLang();
                const name =
                  l === 'ru' ? m.name_ru : l === 'uz-cyrl' ? m.name_uz_cyrl : m.name_uz_latn;
                return (
                  <option key={m.id} value={m.id}>
                    {name}
                  </option>
                );
              })}
            </select>
            <Chevron />
          </span>
        </label>
        <div className="grid grid-cols-[1.4fr_auto_1fr] items-end gap-2.5">
          <F label={t('ev_weight')} value={f.weight_kg} onChange={set('weight_kg')} numeric />
          <Button
            type="button"
            variant="outline"
            onClick={onFetchScale}
            disabled={scaleReading.isPending}
            className="h-12 rounded-[11px] px-3.5 text-sm font-semibold whitespace-nowrap text-primary"
          >
            {scaleReading.isPending ? t('ev_scale_reading') : t('ev_fetch_scale')}
          </Button>
          <F label={t('ev_density')} value={f.density} onChange={set('density')} numeric />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <F label={t('ev_owner')} value={f.owner_name} onChange={set('owner_name')} />
          <F label={t('ev_stir')} value={f.stir} onChange={set('stir')} numeric />
        </div>

        {/* Big preview stat block */}
        <div className="mt-1.5 overflow-hidden rounded-[14px] border">
          <div className="bg-primary-tint px-4 py-[9px] text-xs font-semibold tracking-[0.06em] text-[#15803d] uppercase">
            {t('ev_preview')}
          </div>
          <div className="grid grid-cols-2">
            <div className="border-r border-[#f1f5f9] px-[18px] py-4">
              <div className="mb-1 text-[12.5px] text-slate-500">{t('ev_vol_final')}</div>
              <div className="text-[32px] font-bold tracking-[-0.02em] tabular-nums">
                {preview.volumeFinal}{' '}
                <span className="text-base font-medium text-slate-400">m³</span>
              </div>
            </div>
            <div className="px-[18px] py-4">
              <div className="mb-1 text-[12.5px] text-slate-500">{t('ev_conf')}</div>
              <div className="text-[32px] font-bold tracking-[-0.02em] text-primary tabular-nums">
                {preview.confidence}
                <span className="text-base font-medium text-slate-400">%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[#f1f5f9] px-[18px] py-3">
            <span className="text-[13.5px] text-slate-500">{t('q_status')}</span>
            <StatusPill status={preview.status} />
          </div>
        </div>

        {err && <div className="text-[12.5px] text-[#e11d48]">{err}</div>}
        <Button
          type="submit"
          disabled={create.isPending}
          className="mt-1 h-[52px] w-full rounded-[12px] text-[16px] font-semibold"
        >
          {t('ev_save')}
        </Button>
      </form>
    </Card>
  );
}
