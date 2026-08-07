import { useTranslation } from '@karier/i18n';
import { M1Table, PageHeader, useAuth } from '@karier/ui';

/** "Hodisalar": the raw M-1 event log for this quarry. */
export function Events() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader eyebrow={t('sec_quarry')} title={t('ev_list')} subtitle={t('m1_title')} />
      <M1Table quarryId={user?.quarry_id ?? undefined} canFixPlate />
    </div>
  );
}
