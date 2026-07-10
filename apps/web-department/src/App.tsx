import { useTranslation } from '@karier/i18n';
import { cn, LangSwitcher, ProfileMenu, RequireAuth } from '@karier/ui';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { Dashboard } from './features/Dashboard';
import { DistrictDetail } from './features/DistrictDetail';
import { Dynamics } from './features/Dynamics';
import { Protocols } from './features/Protocols';
import { QuarryDetail } from './features/QuarryDetail';
import { Trips } from './features/Trips';

const NAV = [
  { to: '/dashboard', key: 'nav_dashboard' },
  { to: '/data', key: 'nav_data' },
  { to: '/protocol', key: 'nav_protocol' },
  { to: '/dynamics', key: 'nav_dynamics' },
] as const;

function Header() {
  const { t } = useTranslation();
  // "Karier Kontrol — Departament" → render the suffix (from the dash) muted.
  const title = t('app_department');
  const dashIdx = title.indexOf('—');
  const main = dashIdx > 0 ? title.slice(0, dashIdx).trim() : title;
  const suffix = dashIdx > 0 ? title.slice(dashIdx) : '';

  return (
    <header className="flex h-14 flex-wrap items-center gap-3 border-b bg-white px-[26px] max-md:h-auto max-md:py-2">
      <div className="grid size-[30px] place-items-center rounded-[8px] bg-primary text-sm font-bold text-white">
        K
      </div>
      <strong className="text-[15px] font-semibold text-foreground">
        {main}
        {suffix && <span className="font-medium text-slate-400"> {suffix}</span>}
      </strong>
      <div className="ml-auto flex items-center gap-3.5">
        <LangSwitcher />
        <ProfileMenu />
      </div>
    </header>
  );
}

function Nav() {
  const { t } = useTranslation();
  return (
    <nav className="flex gap-[26px] overflow-x-auto border-b bg-white px-[26px]">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          className={({ isActive }) =>
            cn(
              'whitespace-nowrap border-b-[3px] px-0.5 py-4 text-sm no-underline',
              isActive
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent font-medium text-muted-foreground',
            )
          }
        >
          {t(n.key)}
        </NavLink>
      ))}
    </nav>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['department', 'superadmin']} appKey="app_department" accent="#0d9488">
      <Header />
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/districts/:districtId" element={<DistrictDetail />} />
        <Route
          path="/dashboard/districts/:districtId/quarries/:quarryId"
          element={<QuarryDetail />}
        />
        {/* Ma'lumotlar: per-vehicle stage table (trips); /trips redirects here */}
        <Route path="/data" element={<Trips />} />
        <Route path="/trips" element={<Navigate to="/data" replace />} />
        <Route path="/protocol" element={<Protocols />} />
        <Route path="/dynamics" element={<Dynamics />} />
      </Routes>
    </RequireAuth>
  );
}
