import { useTranslation } from '@karier/i18n';
import { M1Table, PageHeader } from '@karier/ui';

/** "Hodisalar": the raw M-1 event log over every quarry the department can see
 *  (no quarry_id — the backend scopes rows to the user's region). */
export function Events() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('ev_list')}
        subtitle={t('m1_title')}
      />
      <M1Table />
    </div>
  );
}
