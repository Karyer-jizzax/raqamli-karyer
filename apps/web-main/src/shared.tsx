import { currentLang, useTranslation } from '@karier/i18n';
import {
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PasswordInput,
  UiButton as Button,
} from '@karier/ui';
import { type FormEvent, type ReactNode, useId } from 'react';

export function districtName(d: { name_uz_latn: string; name_uz_cyrl: string; name_ru: string }) {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

/** Short unique-ish code derived from a name, for entities that need one client-side. */
export function slugCode(name: string): string {
  const base = name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return (base || 'X') + suffix;
}

/** 32px ghost icon button used in table rows and list rows. */
export const ROW_ACTION =
  'size-8 rounded-lg text-slate-400 hover:bg-[#f1f5f9] hover:text-primary';
export const ROW_ACTION_DANGER =
  'size-8 rounded-lg text-[#f43f5e] hover:bg-[#fff1f2] hover:text-[#e11d48]';

/** Count pill shown next to registry eyebrows in table-card headers. */
export function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-[9px] py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
      {children}
    </span>
  );
}

/**
 * Uppercase eyebrow label — used where the mockup shows one: table-card
 * registry headers and modal headers.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-[11px] font-semibold tracking-[0.09em] uppercase', className)}>
      {children}
    </span>
  );
}

/** Status read-out: colored 8px dot with a soft glow ring plus its label. */
export function StatusDot({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2 text-[13.5px] text-slate-700">
      <span
        className={cn(
          'size-2 rounded-full ring-[3px]',
          active ? 'bg-[#10b981] ring-[#10b981]/15' : 'bg-[#f59e0b] ring-[#f59e0b]/15',
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
      <Label htmlFor={id} className="text-[13px] font-medium text-slate-700">
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
  onClose,
  onSubmit,
  err,
  pending,
  submitLabel,
  cancelLabel,
  children,
}: {
  title: string;
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
          <Eyebrow className="text-slate-400">{t('nav_section')}</Eyebrow>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3.5">
          {children}
          {err && (
            <div className="rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-sm text-[#e11d48]">
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
