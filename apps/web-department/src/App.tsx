import { AppShell, type NavEntry, RequireAuth } from '@karier/ui';
import {
  ChartColumnIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  MountainIcon,
  RadioIcon,
  TruckIcon,
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { Analytics } from './features/Analytics';
import { Dashboard } from './features/Dashboard';
import { DistrictDetail } from './features/DistrictDetail';
import { Events } from './features/Events';
import { Live } from './features/Live';
import { Quarries } from './features/Quarries';
import { QuarryDetail } from './features/QuarryDetail';
import { Trips } from './features/Trips';
import { Waybill } from './features/Waybill';

/** Sidebar entry ↔ route. The shell stays router-free, so the map lives here. */
const NAV: (NavEntry & { path: string })[] = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboardIcon },
  { key: 'analytics', path: '/analytics', labelKey: 'nav_analytics', icon: ChartColumnIcon },
  { key: 'quarries', path: '/quarries', labelKey: 'nav_quarries', icon: MountainIcon },
  { key: 'data', path: '/data', labelKey: 'nav_data', icon: TruckIcon },
  { key: 'events', path: '/events', labelKey: 'ev_list', icon: ClipboardListIcon },
  { key: 'live', path: '/live', labelKey: 'nav_live', icon: RadioIcon },
];

function Shell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The drill-down (/dashboard/districts/…) keeps the dashboard entry lit.
  const active = NAV.find((n) => pathname.startsWith(n.path))?.key ?? 'dashboard';

  return (
    <AppShell
      appKey="app_department"
      sectionKey="sec_oversight"
      items={NAV}
      activeKey={active}
      onSelect={(key) => navigate(NAV.find((n) => n.key === key)?.path ?? '/dashboard')}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/districts/:districtId" element={<DistrictDetail />} />
        <Route
          path="/dashboard/districts/:districtId/quarries/:quarryId"
          element={<QuarryDetail />}
        />
        {/* Analitika: M2–M5 reports over one period */}
        <Route path="/analytics" element={<Analytics />} />
        {/* Karyerlar: flat registry — reaching a quarry without the map */}
        <Route path="/quarries" element={<Quarries />} />
        {/* Ma'lumotlar: per-vehicle stage table (trips); /trips redirects here */}
        <Route path="/data" element={<Trips />} />
        <Route path="/trips" element={<Navigate to="/data" replace />} />
        {/* Hodisalar: raw M-1 event log across all quarries in the region */}
        <Route path="/events" element={<Events />} />
        {/* Jonli ko'rish: viloyatdagi tanlangan karyer kameralari */}
        <Route path="/live" element={<Live />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <Routes>
      {/* Yuk xatidagi QR shu yerga olib keladi — parolsiz, faqat ma'lumot.
          Login talab qilinmasligi uchun RequireAuth'dan tashqarida turadi. */}
      <Route path="/yuk-xati/:tripId" element={<Waybill />} />
      <Route
        path="*"
        element={
          <RequireAuth allowedRoles={['department', 'superadmin']} appKey="app_department">
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
