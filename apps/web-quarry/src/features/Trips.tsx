import { useTranslation } from '@karier/i18n';
import { PageHeader, TripsTable, useAuth } from '@karier/ui';

/** "Ma'lumotlar": one row per vehicle trip through this quarry's zavod scale. */
export function Trips() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Wider than the other screens past xl: the grid carries nine columns, and at
  // the shared 1240px cap the last of them (yuk xati) falls off the edge while
  // the screen still has room to spare.
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6 xl:max-w-[1680px]">
      <PageHeader eyebrow={t('sec_quarry')} title={t('nav_data')} />
      <TripsTable quarryId={user?.quarry_id ?? undefined} />
    </div>
  );
}
