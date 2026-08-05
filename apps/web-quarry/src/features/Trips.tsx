import { useTranslation } from '@karier/i18n';
import { PageHeader, TripsTable, useAuth } from '@karier/ui';

/** "Ma'lumotlar": one row per vehicle trip through this quarry's zavod scale. */
export function Trips() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader eyebrow={t('sec_quarry')} title={t('nav_data')} />
      <TripsTable quarryId={user?.quarry_id ?? undefined} />
    </div>
  );
}
