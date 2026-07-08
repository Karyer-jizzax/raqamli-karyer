import { useTranslation } from '@karier/i18n';
import { LangSwitcher, ProfileMenu, RequireAuth } from '@karier/ui';

import { QuarryDashboard } from './features/QuarryDashboard';

function Shell() {
  const { t } = useTranslation();
  // "Karier Kontrol — Karyer" → brand + dimmed app suffix.
  const [brand, suffix] = t('app_quarry').split(' — ');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[60px] items-center gap-3 border-b bg-card px-7">
        <div className="grid size-8 place-items-center rounded-[9px] bg-primary text-[15px] font-bold text-white">
          K
        </div>
        <strong className="text-base font-semibold">
          {brand}
          {suffix && <span className="font-medium text-slate-400"> — {suffix}</span>}
        </strong>
        <div className="ml-auto flex items-center gap-3.5">
          <LangSwitcher />
          <ProfileMenu />
        </div>
      </header>

      <QuarryDashboard />
    </div>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['operator', 'superadmin']} appKey="app_quarry" accent="#16a34a">
      <Shell />
    </RequireAuth>
  );
}
