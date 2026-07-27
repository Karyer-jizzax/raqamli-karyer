/**
 * Camera evidence: the chips inside a table cell, the preview that follows the
 * cursor, and the full viewer dialog. Both grids used to carry their own copy.
 */
import { mediaUrl, type TripStage } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { CameraIcon, PlayIcon } from 'lucide-react';
import { type MouseEvent, type ReactNode } from 'react';

import { cn } from '../lib/utils';
import { splitDateTime } from './util';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

export interface Preview {
  stage: TripStage;
  video: boolean;
  left: number;
  top: number;
  bottom: number;
}

const CHIP = cn(
  'inline-flex items-center gap-0.5 rounded-[6px] border bg-card px-1.5 py-0.5 text-primary',
  'transition-colors hover:border-primary hover:bg-primary-tint',
);

/** Photo/video chips inside a stage cell; hovering shows a floating preview. */
export function MediaChips({
  stage,
  onPreview,
}: {
  stage: TripStage;
  onPreview: (p: Preview | null) => void;
}) {
  const show = (video: boolean) => (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPreview({ stage, video, left: r.left, top: r.top, bottom: r.bottom });
  };
  const nImg = stage.image_urls?.length ?? 0;
  if (!nImg && !stage.video_url) return null;
  return (
    <span className="mt-1 inline-flex items-center justify-center gap-1">
      {nImg > 0 && (
        <span className={CHIP} onMouseEnter={show(false)} onMouseLeave={() => onPreview(null)}>
          <CameraIcon className="size-3.5" strokeWidth={2} />
          {nImg > 1 && <span className="text-2xs font-semibold tabular-nums">{nImg}</span>}
        </span>
      )}
      {stage.video_url && (
        <span className={CHIP} onMouseEnter={show(true)} onMouseLeave={() => onPreview(null)}>
          <PlayIcon className="size-3.5" fill="currentColor" strokeWidth={0} />
        </span>
      )}
    </span>
  );
}

/** Floating preview card rendered next to the hovered media chip. */
export function HoverPreview({ prev }: { prev: Preview }) {
  const W = 280;
  const H = 200;
  const left = Math.max(8, Math.min(prev.left - W / 2, window.innerWidth - W - 8));
  const below = prev.bottom + H + 16 < window.innerHeight;
  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[200] overflow-hidden rounded-[10px] border bg-card shadow-pop',
        'animate-in fade-in-0 zoom-in-95 duration-150 ease-out',
        below ? 'origin-top' : 'origin-bottom',
      )}
      style={{ left, width: W, top: below ? prev.bottom + 8 : prev.top - H - 8 }}
    >
      {prev.video && prev.stage.video_url ? (
        <video
          src={mediaUrl(prev.stage.video_url)}
          autoPlay
          muted
          loop
          playsInline
          className="block w-full bg-black"
          style={{ height: H, objectFit: 'contain' }}
        />
      ) : (
        <img
          src={mediaUrl(prev.stage.image_urls[0])}
          alt=""
          className="block w-full bg-black"
          style={{ height: H, objectFit: 'contain' }}
        />
      )}
    </div>
  );
}

/** One checkpoint stage inside the trip detail dialog: time + video + photos. */
export function StageSection({ label, stage }: { label: string; stage: TripStage | null }) {
  const { t } = useTranslation();
  if (!stage) return null;
  const dt = splitDateTime(stage.occurred_at);
  return (
    <section className="border-b py-3 last:border-b-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <b className="text-data">{label}</b>
        {dt && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {dt.date} {dt.time}
          </span>
        )}
      </div>
      {stage.video_url && (
        <video
          key={stage.event_id}
          controls
          muted
          playsInline
          poster={mediaUrl(stage.image_urls?.[0])}
          className="mb-1.5 block max-h-[320px] w-full rounded-lg bg-black"
        >
          <source src={mediaUrl(stage.video_url)} type="video/mp4" />
        </video>
      )}
      {(stage.image_urls?.length ?? 0) > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {stage.image_urls.map((u, i) => (
            <img key={i} src={mediaUrl(u)} alt="" className="block w-full rounded-lg" />
          ))}
        </div>
      ) : !stage.video_url ? (
        <p className="m-0 text-data text-muted-foreground">{t('vid_no_image')}</p>
      ) : null}
    </section>
  );
}

/** Full-size evidence viewer: the photo gallery or the clip for one event. */
export function MediaDialog({
  title,
  mode,
  imageUrls,
  videoUrl,
  posterUrl,
  onClose,
}: {
  title: ReactNode;
  mode: 'photo' | 'video';
  imageUrls: string[];
  videoUrl: string | null;
  posterUrl?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const empty = (
    <p className="m-0 bg-surface-subtle px-4 py-12 text-center text-muted-foreground">
      {t('vid_no_image')}
    </p>
  );
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="gap-0 overflow-hidden p-0 sm:max-w-[680px]"
      >
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        </DialogHeader>
        {mode === 'video' ? (
          videoUrl ? (
            <video
              controls
              autoPlay
              muted
              loop
              playsInline
              poster={posterUrl}
              className="block max-h-[70vh] w-full bg-black object-contain"
            >
              <source src={mediaUrl(videoUrl)} type="video/mp4" />
            </video>
          ) : (
            empty
          )
        ) : imageUrls.length > 0 ? (
          // auto-rows-max: keep photo rows content-sized so the gallery scrolls
          // instead of the grid squeezing the images into 70vh
          <div className="grid max-h-[70vh] auto-rows-max gap-1.5 overflow-auto bg-black">
            {imageUrls.map((u, i) => (
              <img key={i} src={mediaUrl(u)} alt="" className="block w-full" />
            ))}
          </div>
        ) : (
          empty
        )}
      </DialogContent>
    </Dialog>
  );
}
