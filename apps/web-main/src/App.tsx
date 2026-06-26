import { useTranslation } from '@karier/i18n';
import { LangSwitcher, ProfileMenu, RequireAuth } from '@karier/ui';
import { useState } from 'react';

import { Geo } from './features/Geo';
import { Quarries } from './features/Quarries';

type Tab = 'quarries' | 'geo';

function Header() {
  const { t } = useTranslation();
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
      <strong style={{ fontSize: 16, color: 'var(--brand)' }}>{t('app_main')}</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <LangSwitcher />
        <ProfileMenu />
      </div>
    </header>
  );
}

function Nav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { t } = useTranslation();
  const items: { key: Tab; label: string }[] = [
    { key: 'quarries', label: t('nav_quarries') },
    { key: 'geo', label: t('nav_geo') },
  ];
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
      {items.map((n) => {
        const active = tab === n.key;
        return (
          <button
            key={n.key}
            onClick={() => setTab(n.key)}
            style={{
              padding: '14px 2px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 14,
              color: active ? 'var(--brand)' : 'var(--muted)',
              borderBottom: `3px solid ${active ? 'var(--brand)' : 'transparent'}`,
            }}
          >
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}

function Home() {
  const [tab, setTab] = useState<Tab>('quarries');
  return (
    <div>
      <Header />
      <Nav tab={tab} setTab={setTab} />
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        {tab === 'quarries' ? <Quarries /> : <Geo />}
      </div>
    </div>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['superadmin']} appKey="app_main" accent="#1d3a5c">
      <Home />
    </RequireAuth>
  );
}
