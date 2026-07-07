import { useTranslation } from '@karier/i18n';
import { cn, LangSwitcher, ProfileMenu, RequireAuth } from '@karier/ui';
import {
  Building2Icon,
  ChevronRightIcon,
  MapIcon,
  MenuIcon,
  PackageIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Departments } from './features/Departments';
import { Geo } from './features/Geo';
import { Materials } from './features/Materials';
import { Quarries } from './features/Quarries';

type Tab = 'quarries' | 'geo' | 'materials' | 'departments';

const NAV: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'quarries', label: 'nav_quarries', icon: Building2Icon },
  { key: 'materials', label: 'nav_materials', icon: PackageIcon },
  { key: 'geo', label: 'nav_geo', icon: MapIcon },
  { key: 'departments', label: 'nav_departments', icon: UsersIcon },
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
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r bg-card',
          'transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* brand lockup */}
        <div className="flex h-[58px] shrink-0 items-center gap-[11px] border-b border-[#f1f5f9] px-5">
          <div className="grid size-8 place-items-center rounded-[9px] bg-primary text-[15px] font-bold text-white">
            K
          </div>
          <div className="flex flex-col leading-[1.15]">
            <span className="text-[13.5px] font-bold tracking-[0.02em]">KARIER KONTROL</span>
            <span className="text-[10.5px] tracking-[0.02em] text-slate-400">
              {t('nav_section')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto cursor-pointer text-slate-400 transition-colors hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-[3px] px-3 py-3.5">
          <span className="px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.11em] text-slate-400 uppercase">
            {t('nav_section')}
          </span>
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
                  'flex cursor-pointer items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
                  active
                    ? 'bg-primary-tint font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-[#f8fafc] hover:text-foreground',
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.7} />
                {t(n.label)}
              </button>
            );
          })}
        </nav>

        {/* role footer */}
        <div className="border-t border-[#f1f5f9] px-5 py-3.5">
          <span className="text-[10.5px] font-semibold tracking-[0.11em] text-slate-300 uppercase">
            Superadmin
          </span>
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
    <header className="sticky top-0 z-20 flex h-[58px] items-center gap-2.5 border-b bg-white/85 px-4 backdrop-blur-md lg:px-[26px]">
      <button
        onClick={onMenu}
        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="size-5" />
      </button>
      {/* breadcrumb: section › page */}
      <span className="hidden text-xs text-slate-400 sm:inline">{section}</span>
      <ChevronRightIcon className="hidden size-3.5 text-slate-300 sm:inline" strokeWidth={2} />
      <h1 className="text-[15.5px] font-semibold tracking-[-0.01em]">{title}</h1>
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
      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <Topbar
          section={t('nav_section')}
          title={title}
          onMenu={() => setSidebarOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1080px] flex-1 p-4 lg:p-6">
          {tab === 'quarries' ? (
            <Quarries />
          ) : tab === 'materials' ? (
            <Materials />
          ) : tab === 'geo' ? (
            <Geo />
          ) : (
            <Departments />
          )}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['superadmin']} appKey="app_main" accent="#4f46e5">
      <Home />
    </RequireAuth>
  );
}
