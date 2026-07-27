/**
 * Small shared building blocks. These grew inside web-main/src/shared.tsx and
 * were lifted here so web-department and web-quarry use the same vocabulary
 * instead of re-inventing an eyebrow / status dot / modal shell per screen.
 */
import { currentLang, useTranslation } from '@karier/i18n';
import { type FormEvent, type ReactNode, useId } from 'react';

import { cn } from './lib/utils';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input, PasswordInput } from './ui/input';
import { Label } from './ui/label';

/** Pick the field matching the active language from any `name_*` record. */
export function localizedName(d: {
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
}): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

/** Registry table header cell — the same three copies web-main had inline. */
export const TH =
  'h-auto px-[18px] py-[11px] text-2xs font-semibold uppercase tracking-[0.08em] text-slate-400';

/** 32px ghost icon button used in table rows and list rows. */
export const ROW_ACTION = 'size-8 rounded-lg text-slate-400 hover:bg-secondary hover:text-primary';
export const ROW_ACTION_DANGER =
  'size-8 rounded-lg text-danger hover:bg-danger-tint hover:text-danger';

/** Count pill shown next to registry eyebrows in table-card headers. */
export function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-[9px] py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
      {children}
    </span>
  );
}

/** Uppercase eyebrow label — section headers, table-card headers, modals. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-2xs font-semibold tracking-[0.09em] uppercase', className)}>
      {children}
    </span>
  );
}

/** Status read-out: colored 8px dot with a soft glow ring plus its label. */
export function StatusDot({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2 text-data text-slate-700">
      <span
        className={cn(
          'size-2 rounded-full ring-[3px]',
          active ? 'bg-success ring-success/15' : 'bg-warning ring-warning/15',
        )}
        aria-hidden
      />
      {t(active ? 'q_st_active' : 'q_st_suspended')}
    </span>
  );
}

/** Labelled text input built on the shadcn Input/Label primitives. */
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required = true,
  readOnly = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (s: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-data font-medium text-slate-700">
        {label}
      </Label>
      {type === 'password' ? (
        <PasswordInput
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn('h-[42px]', readOnly && 'bg-muted text-muted-foreground')}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          type={type}
          autoComplete={autoComplete}
          required={required}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn('h-[42px]', readOnly && 'bg-muted text-muted-foreground')}
        />
      )}
    </div>
  );
}

/** Dialog hosting a form with standard cancel/submit footer actions. */
export function ModalForm({
  title,
  eyebrow,
  onClose,
  onSubmit,
  err,
  pending,
  submitLabel,
  cancelLabel,
  children,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  err?: string;
  pending: boolean;
  submitLabel: string;
  cancelLabel?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader className="gap-1">
          <Eyebrow className="text-slate-400">{eyebrow ?? t('nav_section')}</Eyebrow>
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3.5">
          {children}
          {err && (
            <div className="rounded-[10px] border border-danger/25 bg-danger-tint px-3 py-2 text-sm text-danger">
              {err}
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
              className="h-[42px] px-[18px] text-sm font-medium"
            >
              {cancelLabel ?? t('q_cancel')}
            </Button>
            <Button type="submit" disabled={pending} className="h-[42px] px-5">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
