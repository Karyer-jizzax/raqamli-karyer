import { analyzeFrame, ingestFrame } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { Button } from '@karier/ui';
import { useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, type Dispatch, type SetStateAction, useRef, useState } from 'react';

import type { EventForm } from './RegisterForm';

/**
 * AI video stage: uploaded frame preview, detection bbox overlay and the
 * upload / analyze / autosave actions. Detection results are written back
 * into the register form via `setF`.
 */
export function AiStage({
  postId,
  cameraId,
  setF,
  setErr,
}: {
  postId: string;
  cameraId: string | undefined;
  setF: Dispatch<SetStateAction<EventForm>>;
  setErr: (s: string) => void;
}) {
  const { t } = useTranslation();

  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [bbox, setBbox] = useState<number[] | null>(null);
  const [detLabel, setDetLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
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
      await ingestFrame(file, { postId: postId || undefined, cameraId });
      await qc.invalidateQueries({ queryKey: ['events'] });
    } catch {
      setErr('Ingest xatosi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* AI stage: image + bbox overlay */}
      <div className="relative mb-3.5 aspect-[16/10] overflow-hidden rounded-[14px] bg-[#171717] bg-[repeating-linear-gradient(135deg,#1c1c1c_0_14px,#191919_14px_28px)]">
        {imageUrl && (
          <img src={imageUrl} alt="frame" className="absolute inset-0 h-full w-full object-cover" />
        )}

        {/* REC badge */}
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-[9px] py-1 text-[11px] font-semibold tracking-[0.04em] text-white">
          <span className="size-[7px] animate-pulse rounded-full bg-[#22c55e]" aria-hidden />
          REC
        </span>

        {/* camera hint */}
        <span className="absolute top-3 left-3.5 text-[11.5px] tracking-[0.02em] text-[#71717a]">
          jonli oqim · 1920×1080
        </span>

        {/* detection frame */}
        {bbox && (
          <div
            className="absolute rounded-[6px] border-[2.5px] border-[#22c55e] shadow-[0_0_0_9999px_rgba(0,0,0,0.12)]"
            style={{
              left: `${bbox[0]! * 100}%`,
              top: `${bbox[1]! * 100}%`,
              width: `${bbox[2]! * 100}%`,
              height: `${bbox[3]! * 100}%`,
            }}
          >
            <span className="absolute -top-[26px] -left-[2px] rounded-[6px] bg-primary px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-white">
              {detLabel}
            </span>
          </div>
        )}

        {!imageUrl && (
          <span className="absolute bottom-3 left-3.5 text-xs text-[#a1a1aa]">
            {t('vid_no_image')}
          </span>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
      <div className="mb-5 flex gap-[9px]">
        <Button
          variant="outline"
          className="h-[46px] flex-1 rounded-[11px] text-[14.5px]"
          onClick={() => fileRef.current?.click()}
        >
          {t('vid_upload')}
        </Button>
        <Button
          className="h-[46px] flex-1 rounded-[11px] text-[14.5px]"
          onClick={onAnalyze}
          disabled={busy}
        >
          {busy ? t('vid_analyzing') : t('vid_analyze')}
        </Button>
        <Button
          variant="outline"
          className="h-[46px] flex-1 rounded-[11px] text-[14.5px]"
          onClick={onIngest}
          disabled={busy}
        >
          {t('vid_autosave')}
        </Button>
      </div>
    </>
  );
}
