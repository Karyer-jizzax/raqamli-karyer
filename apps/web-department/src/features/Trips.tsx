import { useTranslation } from '@karier/i18n';
import { PageHeader, TripsTable } from '@karier/ui';

/** "Ma'lumotlar": one row per vehicle trip, across every quarry in the region. */
export function Trips() {
  const { t } = useTranslation();
  // Wider than the other screens past xl: the grid carries ten columns, and at
  // the shared 1240px cap the last of them (yuk xati) falls off the edge while
  // the screen still has room to spare.
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6 xl:max-w-[1680px]">
      <PageHeader eyebrow={t('sec_oversight')} title={t('nav_data')} />
      <TripsTable />
    </div>
  );
}
