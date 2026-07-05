import { useTranslation } from '@karier/i18n';
import { cn, LangSwitcher, ProfileMenu, RequireAuth } from '@karier/ui';
import {
  Building2Icon,
  ChevronRightIcon,
  MapIcon,
  MenuIcon,
  PackageIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Geo } from './features/Geo';
import { Materials } from './features/Materials';
import { Quarries } from './features/Quarries';
import { Eyebrow } from './shared';

type Tab = 'quarries' | 'geo' | 'materials';

const NAV: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'quarries', label: 'nav_quarries', icon: Building2Icon },
  { key: 'materials', label: 'nav_materials', icon: PackageIcon },
  { key: 'geo', label: 'nav_geo', icon: MapIcon },
];

function Sidebar({
  tab,
  setTab,
  open,
  onClose,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-[#081320]/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-gradient-to-b from-[#10233b] to-[#0b1a2d] text-slate-300',
          'border-r border-white/5 transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* brand lockup */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-5">
          <div className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-[#3b6ea5] to-[#1d3a5c] ring-1 ring-white/10">
            <Building2Icon className="size-4.5 text-white" />
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-bold tracking-[0.14em] text-white">KARIER</div>
            <Eyebrow className="text-[8.5px] tracking-[0.3em] text-slate-500">KONTROL</Eyebrow>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 transition-colors hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <Eyebrow className="px-3 pt-2 pb-1.5 text-slate-500">{t('nav_section')}</Eyebrow>
          {NAV.map((n) => {
            const active = tab === n.key;
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                onClick={() => {
                  setTab(n.key);
                  onClose();
                }}
                className={cn(
                  'group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-[#5b8fc7]/50 focus-visible:outline-none',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )}
              >
                {/* active accent bar */}
                <span
                  className={cn(
                    'absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#5b8fc7] transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                <Icon className={cn('size-4.5', active ? 'text-[#7fb0e0]' : 'text-slate-500')} />
                {t(n.label)}
              </button>
            );
          })}
        </nav>

        {/* role footer */}
        <div className="border-t border-white/5 px-5 py-3.5">
          <Eyebrow className="text-slate-500">Superadmin</Eyebrow>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  section,
  title,
  onMenu,
}: {
  section: string;
  title: string;
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur lg:px-6">
      <button
        onClick={onMenu}
        className="text-muted-foreground hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="size-5" />
      </button>
      {/* breadcrumb: section / page */}
      <div className="flex items-center gap-2">
        <Eyebrow className="hidden text-muted-foreground sm:inline">{section}</Eyebrow>
        <ChevronRightIcon className="hidden size-3.5 text-muted-foreground/50 sm:inline" />
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="ml-auto flex items-center gap-3.5">
        <LangSwitcher />
        <ProfileMenu />
      </div>
    </header>
  );
}

function Home() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('quarries');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const title = t(NAV.find((n) => n.key === tab)?.label ?? 'nav_quarries');

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        tab={tab}
        setTab={setTab}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:pl-60">
        <Topbar
          section={t('nav_section')}
          title={title}
          onMenu={() => setSidebarOpen(true)}
        />
        <main className="mx-auto max-w-6xl p-4 lg:p-6">
          {tab === 'quarries' ? <Quarries /> : tab === 'materials' ? <Materials /> : <Geo />}
        </main>
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
