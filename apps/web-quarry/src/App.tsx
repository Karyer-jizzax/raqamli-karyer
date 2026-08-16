import { AppShell, type NavEntry, RequireAuth } from '@karier/ui';
import { ClipboardListIcon, LayoutDashboardIcon, RadioIcon, TruckIcon } from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { Dashboard } from './features/Dashboard';
import { Events } from './features/Events';
import { Live } from './features/Live';
import { Trips } from './features/Trips';
import { Waybill } from './features/Waybill';

/** Sidebar entry ↔ route. The shell stays router-free, so the map lives here. */
const NAV: (NavEntry & { path: string })[] = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboardIcon },
  { key: 'trips', path: '/trips', labelKey: 'nav_data', icon: TruckIcon },
  { key: 'events', path: '/events', labelKey: 'ev_list', icon: ClipboardListIcon },
  { key: 'live', path: '/live', labelKey: 'nav_live', icon: RadioIcon },
];

function Shell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = NAV.find((n) => pathname.startsWith(n.path))?.key ?? 'dashboard';

  return (
    <AppShell
      appKey="app_quarry"
      sectionKey="sec_quarry"
      items={NAV}
      activeKey={active}
      onSelect={(key) => navigate(NAV.find((n) => n.key === key)?.path ?? '/dashboard')}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Ma'lumotlar: per-vehicle stage table for this quarry */}
        <Route path="/trips" element={<Trips />} />
        {/* Hodisalar: raw M-1 event log */}
        <Route path="/events" element={<Events />} />
        {/* Jonli ko'rish: agent tanlagan rejim (oqim yoki JPEG kadr) */}
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
          <RequireAuth allowedRoles={['operator', 'superadmin']} appKey="app_quarry">
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
