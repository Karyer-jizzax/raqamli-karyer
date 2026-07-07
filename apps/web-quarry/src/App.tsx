import { useTranslation } from '@karier/i18n';
import { LangSwitcher, ProfileMenu, RequireAuth } from '@karier/ui';

import { EventList } from './features/EventList';
import { RegisterForm } from './features/RegisterForm';

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

      <div className="mx-auto grid w-full max-w-[1260px] flex-1 grid-cols-1 items-start gap-[22px] p-[26px] lg:grid-cols-[440px_1fr]">
        <RegisterForm />
        <div className="flex min-w-0 flex-col gap-3.5">
          <h1 className="text-xl font-semibold">{t('ev_list')}</h1>
          <EventList />
        </div>
      </div>
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
