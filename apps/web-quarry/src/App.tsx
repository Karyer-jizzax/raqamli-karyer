import { useTranslation } from '@karier/i18n';
import { AppHeader, ProfileMenu, QuarryOverview, RequireAuth, useAuth } from '@karier/ui';

function Shell() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title={t('app_quarry')}>
        <ProfileMenu />
      </AppHeader>
      <QuarryOverview quarryId={user?.quarry_id ?? undefined} />
    </div>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['operator', 'superadmin']} appKey="app_quarry">
      <Shell />
    </RequireAuth>
  );
}
