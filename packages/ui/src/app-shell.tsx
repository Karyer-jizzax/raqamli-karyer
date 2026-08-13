/**
 * Sidebar chrome shared by web-department and web-quarry.
 *
 * Both apps outgrew a top nav: the department now has five screens plus a
 * drill-down, and the quarry app five. Router-free like the rest of the
 * package — the app owns its routes and hands us `activeKey` + `onSelect`.
 */
import { useTranslation } from '@karier/i18n';
import { ChevronRightIcon, type LucideIcon, MenuIcon, XIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { ProfileMenu } from './auth';
import { LangSwitcher } from './components';
import { cn } from './lib/utils';

export interface NavEntry {
  /** Stable id the app maps to a route. */
  key: string;
  /** i18n key — the shell translates it. */
  labelKey: string;
  icon: LucideIcon;
  /** Count shown on the right (work queues); 0 and undefined both hide it. */
  badge?: number;
}

function NavList({
  items,
  activeKey,
  onSelect,
}: {
  items: NavEntry[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {items.map((n) => {
        const active = n.key === activeKey;
        const Icon = n.icon;
        return (
          <button
            key={n.key}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(n.key)}
            className={cn(
              'flex cursor-pointer items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-left text-sm font-medium',
              'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
              active
                ? 'bg-primary-tint font-semibold text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.7} />
            <span className="truncate">{t(n.labelKey)}</span>
            {!!n.badge && (
              <span className="ml-auto rounded-full bg-warning-tint px-1.5 py-0.5 text-2xs font-bold text-warning tabular-nums">
                {n.badge}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

/**
 * @param appKey  i18n key of the app title ("Karyer Kontrol — Karyer"); the
 *                part after the dash becomes the sidebar subtitle, and a title
 *                with no dash leaves the subtitle off entirely.
 * @param title   Topbar heading; defaults to the active nav entry's label.
 */
export function AppShell({
  appKey,
  sectionKey,
  items,
  activeKey,
  onSelect,
  title,
  children,
}: {
  appKey: string;
  sectionKey: string;
  items: NavEntry[];
  activeKey: string;
  onSelect: (key: string) => void;
  title?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const suffix = t(appKey).split(' — ')[1] ?? '';
  const active = items.find((n) => n.key === activeKey);
  const heading = title ?? (active ? t(active.labelKey) : '');

  const select = (key: string) => {
    setOpen(false);
    onSelect(key);
  };

  return (
    <div className="min-h-screen bg-background">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
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
        <div className="flex h-[58px] shrink-0 items-center gap-[11px] border-b px-5">
          <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary text-sm font-bold text-primary-foreground">
            K
          </div>
          <div className="flex min-w-0 flex-col leading-[1.15]">
            <span className="truncate text-data font-bold tracking-[0.02em]">KARYER KONTROL</span>
            {suffix && (
              <span className="truncate text-2xs tracking-[0.02em] text-muted-foreground">
                {suffix}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground lg:hidden"
            aria-label={t('nav_close')}
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <nav aria-label={t(sectionKey)} className="flex flex-1 flex-col gap-[3px] px-3 py-3.5">
          <span className="px-3 pt-2 pb-1 text-2xs font-semibold tracking-[0.11em] text-muted-foreground uppercase">
            {t(sectionKey)}
          </span>
          <NavList items={items} activeKey={activeKey} onSelect={select} />
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[58px] shrink-0 items-center gap-2.5 border-b bg-card/85 px-4 backdrop-blur-md lg:px-[26px]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer text-muted-foreground hover:text-foreground lg:hidden"
            aria-label={t('nav_open')}
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="hidden text-xs text-muted-foreground sm:inline">{t(sectionKey)}</span>
          <ChevronRightIcon
            className="hidden size-3.5 text-slate-300 sm:inline"
            strokeWidth={2}
            aria-hidden
          />
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{heading}</h1>
          <div className="ml-auto flex shrink-0 items-center gap-3.5">
            <LangSwitcher />
            <ProfileMenu />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
