import { useTranslation } from '@karier/i18n';
import { AppHeader, navLink, ProfileMenu, RequireAuth, TopNav } from '@karier/ui';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { Dashboard } from './features/Dashboard';
import { DistrictDetail } from './features/DistrictDetail';
import { Events } from './features/Events';
import { QuarryDetail } from './features/QuarryDetail';
import { Trips } from './features/Trips';

const NAV = [
  { to: '/dashboard', key: 'nav_dashboard' },
  { to: '/data', key: 'nav_data' },
  { to: '/events', key: 'ev_list' },
] as const;

export function App() {
  const { t } = useTranslation();
  return (
    <RequireAuth allowedRoles={['department', 'superadmin']} appKey="app_department">
      <div className="flex min-h-screen flex-col">
        <AppHeader title={t('app_department')}>
          <ProfileMenu />
        </AppHeader>
        <TopNav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => navLink(isActive)}>
              {t(n.key)}
            </NavLink>
          ))}
        </TopNav>
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
          {/* Hodisalar: raw M-1 event log across all quarries in the region */}
          <Route path="/events" element={<Events />} />
        </Routes>
      </div>
    </RequireAuth>
  );
}
