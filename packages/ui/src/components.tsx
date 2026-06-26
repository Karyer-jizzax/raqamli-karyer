import type { Lang, StatusKey } from '@karier/types';
import { LANGS } from '@karier/types';
import { currentLang, setLang, useTranslation } from '@karier/i18n';
import { CheckIcon, ChevronDownIcon, GlobeIcon } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react';

import { Badge } from './ui/badge';
import { Button as UIButton } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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
    <div
      className={cn(
        'bg-card text-card-foreground rounded-xl border p-5 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

const STATUS_VARIANT: Record<StatusKey, 'success' | 'warning' | 'destructive'> = {
  confirm: 'success',
  flagged: 'warning',
  inspect: 'destructive',
};

export function StatusPill({ status }: { status: StatusKey }) {
  const { t } = useTranslation();
  return (
    <Badge variant={STATUS_VARIANT[status]} className="rounded-full">
      {t(`status_${status}`)}
    </Badge>
  );
}

const LANG_LABELS: Record<Lang, string> = {
  'uz-latn': 'UZ',
  'uz-cyrl': 'ЎЗ',
  ru: 'RU',
};

const LANG_NAMES: Record<Lang, string> = {
  'uz-latn': "O'zbekcha",
  'uz-cyrl': 'Ўзбекча',
  ru: 'Русский',
};

export function LangSwitcher() {
  const [lang, setLangState] = useState<Lang>(currentLang());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UIButton variant="outline" size="sm" className="font-semibold">
          <GlobeIcon className="text-muted-foreground" />
          {LANG_LABELS[lang]}
          <ChevronDownIcon className="text-muted-foreground" />
        </UIButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => {
              setLang(l);
              setLangState(l);
            }}
            className={cn('justify-between', l === lang && 'font-semibold')}
          >
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground w-6 text-xs">{LANG_LABELS[l]}</span>
              {LANG_NAMES[l]}
            </span>
            {l === lang && <CheckIcon className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
