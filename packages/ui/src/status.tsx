/**
 * One place for "what color does this state get".
 *
 * Trip stages, M-1 statuses, gate directions and trip kinds were each
 * re-declaring their own hex pairs in every screen, so the same `chala` badge
 * could drift between the two apps. Screens now name a *tone* and the palette
 * lives in globals.css.
 */
import type { StatusKey } from '@karier/types';
import type { ReactNode } from 'react';

import { cn } from './lib/utils';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'stage' | 'neutral';

/** Tinted background + readable foreground, for chips and badges. */
export const TONE_CHIP: Record<Tone, string> = {
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  info: 'bg-info-tint text-info',
  stage: 'bg-stage-tint text-stage',
  neutral: 'bg-secondary text-muted-foreground',
};

/** Foreground only, for inline emphasis inside a table cell. */
export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  stage: 'text-stage',
  neutral: 'text-muted-foreground',
};

/** Solid dot, for camera/post health strips. */
export const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  stage: 'bg-stage',
  neutral: 'bg-slate-300',
};

/** karyerda → yolda → zavodda → yakunlandi; chala = unfinished, yuk_emas = empty run. */
export const TRIP_STAGE_TONE = {
  karyerda: 'info',
  yolda: 'info',
  zavodda: 'stage',
  yakunlandi: 'success',
  chala: 'danger',
  yuk_emas: 'neutral',
} as const satisfies Record<string, Tone>;

/** M-1 row status: inspect/no_plate need an operator, flagged needs a second look.
 *  Four distinct tones — the status split chart puts them side by side, and two
 *  segments in the same red would read as one. */
export const M1_STATUS_TONE: Record<StatusKey, Tone> = {
  confirm: 'success',
  flagged: 'stage',
  inspect: 'warning',
  no_plate: 'danger',
};

/** Chart fill per tone. Charts take a color, not a class — same semantics. */
export const TONE_FILL: Record<Tone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  stage: 'var(--stage)',
  neutral: 'var(--chart-context)',
};

/** Gate direction — exit is the billable movement, enter is the return leg.
 *  `direction` arrives as a plain string, so unknown values fall back to neutral. */
export const DIRECTION_TONE: Record<string, Tone | undefined> = {
  exit: 'success',
  enter: 'warning',
};

export function directionTone(direction: string): Tone {
  return DIRECTION_TONE[direction] ?? 'neutral';
}

/** Trip kind — karyer = raw material in, tashqi = product sold out. */
export const TRIP_KIND_TONE = { karyer: 'success', tashqi: 'stage' } as const;

/** Event source — zavod scale vs karyer eco-post. */
export const SOURCE_TONE = { zavod: 'stage', karyer: 'info' } as const;

/** Rounded status chip. The one badge shape used across both apps. */
export function Chip({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-2xs font-semibold whitespace-nowrap',
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
