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
  UiButton as Button,
} from '@karier/ui';
import { type FormEvent, type ReactNode, useId } from 'react';

export function districtName(d: { name_uz_latn: string; name_uz_cyrl: string; name_ru: string }) {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

/**
 * Uppercase instrument label — the unifying typographic device across the
 * command-console chrome (sidebar sections, panel titles, table headers, stats).
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-[10px] font-semibold tracking-[0.18em] uppercase', className)}>
      {children}
    </span>
  );
}

/** Status read-out: a colored signal dot plus its label, as on a control panel. */
export function StatusDot({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <span
        className={cn(
          'size-2 rounded-full ring-2',
          active ? 'bg-emerald-500 ring-emerald-500/20' : 'bg-amber-500 ring-amber-500/20',
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
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        required={required}
        readOnly={readOnly}
        placeholder={placeholder}
        className={readOnly ? 'bg-muted text-muted-foreground' : undefined}
      />
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
          <Eyebrow className="text-muted-foreground">{t('nav_section')}</Eyebrow>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          {children}
          {err && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {cancelLabel ?? t('q_cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
