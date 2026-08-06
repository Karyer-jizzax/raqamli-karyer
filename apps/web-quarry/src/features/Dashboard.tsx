import { QuarryOverview, useAuth } from '@karier/ui';

/** The operator's own quarry at a glance. The two data grids live on their own
 *  sidebar screens now, so the tabs stay off here — and so does the status
 *  split, which is an oversight comparison rather than the operator's work. */
export function Dashboard() {
  const { user } = useAuth();
  return (
    <QuarryOverview
      quarryId={user?.quarry_id ?? undefined}
      showData={false}
      showStatusSplit={false}
    />
  );
}
