import { useTranslation } from '@karier/i18n';
import { M1Table, PageHeader, useAuth } from '@karier/ui';

/**
 * The operator's work queue: events the system could not close on its own.
 * `no_plate` — ANPR failed, the plate must be typed in from the photo (the
 * grid's plate cell opens that modal); `inspect` — the material needs a human
 * to confirm it.
 */
export const INBOX_STATUSES: readonly string[] = ['no_plate', 'inspect'];

export function Inbox() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_quarry')}
        title={t('nav_inbox')}
        subtitle={t('inbox_subtitle')}
      />
      <M1Table quarryId={user?.quarry_id ?? undefined} statuses={INBOX_STATUSES} />
    </div>
  );
}
