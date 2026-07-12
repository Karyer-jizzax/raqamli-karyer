import type { Lang, StatusKey } from '@karier/types';
import { LANGS } from '@karier/types';
import { currentLang, setLang, useTranslation } from '@karier/i18n';
import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react';

import { Button as UIButton } from './ui/button';
import { cn } from './lib/utils';

/**
 * Back-compat Button used across all three apps. The original API exposed
 * `variant: 'primary' | 'ghost'`; we map those onto the shadcn variants so
 * existing call sites keep working while gaining the new styling.
 */
export function Button({
  variant = 'primary',
  size,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  const mapped =
    variant === 'primary' ? 'default' : variant === 'ghost' ? 'outline' : variant;
  return <UIButton variant={mapped} size={size} className={className} {...rest} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-card text-card-foreground rounded-2xl border p-5', className)}>
      {children}
    </div>
  );
}

/** Soft pastel status badges (confirm / flagged / inspect / no_plate). */
const STATUS_CLASSES: Record<StatusKey, string> = {
  confirm: 'bg-[#ecfdf5] text-[#059669]',
  flagged: 'bg-[#fffbeb] text-[#d97706]',
  inspect: 'bg-[#fff1f2] text-[#e11d48]',
  no_plate: 'bg-[#fef2f2] text-[#dc2626]',
};

export function StatusPill({ status }: { status: StatusKey }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
        STATUS_CLASSES[status],
      )}
    >
      {t(`status_${status}`)}
    </span>
  );
}

const LANG_LABELS: Record<Lang, string> = {
  'uz-latn': 'UZ',
  'uz-cyrl': 'ЎЗ',
  ru: 'RU',
};

/** Segmented language pills (UZ / ЎЗ / RU) used in headers and the login card. */
export function LangSwitcher() {
  const [lang, setLangState] = useState<Lang>(currentLang());

  return (
    <div className="inline-flex gap-0.5 rounded-[9px] bg-secondary p-[3px]">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            setLang(l);
            setLangState(l);
          }}
          className={cn(
            'cursor-pointer rounded-[7px] border-none px-3 py-1.5 text-xs font-semibold transition-colors',
            l === lang
              ? 'bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,.08)]'
              : 'text-slate-400 hover:text-slate-600',
          )}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
