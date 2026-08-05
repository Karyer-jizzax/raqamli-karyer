import { useTranslation } from '@karier/i18n';
import { M1Table, PageHeader, Tabs, TripsTable } from '@karier/ui';
import { useState } from 'react';

/** Trips that entered the zavod but never left — the netto is unaccounted for. */
const VIOLATION_STAGES: readonly string[] = ['chala'];
/** Events an operator or a rule marked for follow-up. */
const FLAGGED_STATUSES: readonly string[] = ['flagged'];

/** The inspector's queue: everything the system could not close cleanly. */
export function Violations() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'trips' | 'events'>('trips');

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('nav_violations')}
        subtitle={t('viol_subtitle')}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'trips', label: t('viol_tab_trips') },
          { value: 'events', label: t('viol_tab_events') },
        ]}
      />
      {tab === 'trips' ? (
        <TripsTable stages={VIOLATION_STAGES} />
      ) : (
        <M1Table statuses={FLAGGED_STATUSES} />
      )}
    </div>
  );
}
