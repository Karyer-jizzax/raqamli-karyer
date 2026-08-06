import { useM1 } from '@karier/api-client';
import { AppShell, type NavEntry, RequireAuth, useAuth } from '@karier/ui';
import {
  CameraIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  RadioIcon,
  SearchCheckIcon,
  TruckIcon,
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { Cameras } from './features/Cameras';
import { Dashboard } from './features/Dashboard';
import { Events } from './features/Events';
import { Inbox, INBOX_STATUSES } from './features/Inbox';
import { Live } from './features/Live';
import { Trips } from './features/Trips';

/** Sidebar entry ↔ route. The shell stays router-free, so the map lives here. */
const NAV: (NavEntry & { path: string })[] = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboardIcon },
  { key: 'trips', path: '/trips', labelKey: 'nav_data', icon: TruckIcon },
  { key: 'events', path: '/events', labelKey: 'ev_list', icon: ClipboardListIcon },
  { key: 'inbox', path: '/inbox', labelKey: 'nav_inbox', icon: SearchCheckIcon },
  { key: 'live', path: '/live', labelKey: 'nav_live', icon: RadioIcon },
  { key: 'cameras', path: '/cameras', labelKey: 'nav_cameras', icon: CameraIcon },
];

function Shell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const quarryId = user?.quarry_id ?? undefined;

  // Same query key as the M-1 grid, so the badge rides along on a cached fetch.
  const { data: m1 } = useM1(quarryId ? { limit: '500', quarry_id: quarryId } : { limit: '500' });
  const inbox = (m1?.rows ?? []).filter((r) => INBOX_STATUSES.includes(r.status)).length;

  const items = NAV.map((n) => (n.key === 'inbox' ? { ...n, badge: inbox } : n));
  const active = NAV.find((n) => pathname.startsWith(n.path))?.key ?? 'dashboard';

  return (
    <AppShell
      appKey="app_quarry"
      sectionKey="sec_quarry"
      items={items}
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
        {/* Operator work queue: unreadable plates + unconfirmed material */}
        <Route path="/inbox" element={<Inbox />} />
        {/* Jonli ko'rish: agent tanlagan rejim (oqim yoki JPEG kadr) */}
        <Route path="/live" element={<Live />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['operator', 'superadmin']} appKey="app_quarry">
      <Shell />
    </RequireAuth>
  );
}
