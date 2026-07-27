import { useTranslation } from '@karier/i18n';
import { PageHeader, TripsTable } from '@karier/ui';

/** "Ma'lumotlar": one row per vehicle trip, across every quarry in the region. */
export function Trips() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader eyebrow={t('sec_oversight')} title={t('nav_data')} />
      <TripsTable />
    </div>
  );
}
