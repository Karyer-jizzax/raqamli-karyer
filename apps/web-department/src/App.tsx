import { useHealth } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { Button, Card, LangSwitcher, RequireAuth, useAuth } from '@karier/ui';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { Dashboard } from './features/Dashboard';
import { DataM1 } from './features/DataM1';
import { Dynamics } from './features/Dynamics';
import { Protocols } from './features/Protocols';

const NAV = [
  { to: '/dashboard', key: 'nav_dashboard' },
  { to: '/video', key: 'nav_video' },
  { to: '/data', key: 'nav_data' },
  { to: '/protocol', key: 'nav_protocol' },
  { to: '/dynamics', key: 'nav_dynamics' },
] as const;

function HealthBadge() {
  const { t } = useTranslation();
  const { data, isError } = useHealth();
  const ok = data?.status === 'ok' && !isError;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: ok ? 'var(--green)' : 'var(--red)' }}>
      ● {ok ? t('backend_connected') : t('backend_offline')}
    </span>
  );
}

function Header() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '11px 24px',
        background: '#fff',
        borderBottom: '1px solid var(--line)',
        flexWrap: 'wrap',
      }}
    >
      <strong style={{ fontSize: 16, color: 'var(--brand)' }}>{t('app_department')}</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <HealthBadge />
        <LangSwitcher />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user?.full_name || user?.username}</span>
        <Button variant="ghost" onClick={logout}>
          {t('logout')}
        </Button>
      </div>
    </header>
  );
}

function Nav() {
  const { t } = useTranslation();
  return (
    <nav
      style={{
        display: 'flex',
        gap: 22,
        padding: '0 24px',
        background: '#fff',
        borderBottom: '1px solid var(--line)',
        overflowX: 'auto',
      }}
    >
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          style={({ isActive }) => ({
            padding: '14px 2px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textDecoration: 'none',
            color: isActive ? 'var(--brand)' : 'var(--muted)',
            borderBottom: `3px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
          })}
        >
          {t(n.key)}
        </NavLink>
      ))}
    </nav>
  );
}

function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 24 }}>
      <Card>
        <h2 style={{ margin: '0 0 6px' }}>{t(titleKey)}</h2>
        <p style={{ color: 'var(--muted)', margin: 0 }}>{t('coming_soon')}</p>
      </Card>
    </div>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['department', 'superadmin']} appKey="app_department" accent="#1f7d68">
      <Header />
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/video" element={<Placeholder titleKey="nav_video" />} />
        <Route path="/data" element={<DataM1 />} />
        <Route path="/protocol" element={<Protocols />} />
        <Route path="/dynamics" element={<Dynamics />} />
      </Routes>
    </RequireAuth>
  );
}
