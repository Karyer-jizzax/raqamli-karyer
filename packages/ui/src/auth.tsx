import {
  ApiError,
  type AuthUserDto,
  changePassword,
  getMe,
  getToken,
  login as apiLogin,
  setRefreshToken,
  setToken,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import type { Role } from '@karier/types';
import { KeyRoundIcon, LogOutIcon } from 'lucide-react';
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { LangSwitcher } from './components';
import { cn } from './lib/utils';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input, PasswordInput } from './ui/input';
import { Label } from './ui/label';

interface AuthContextValue {
  user: AuthUserDto | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUserDto>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from a stored token on startup.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        setToken(null);
        setRefreshToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (username, password) => {
        const res = await apiLogin(username, password);
        setUser(res.user);
        return res.user;
      },
      logout: () => {
        setToken(null);
        setRefreshToken(null);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/**
 * Renders the login screen until authenticated. If `allowedRoles` is set,
 * a user whose role is not permitted for this app is rejected.
 */
export function RequireAuth({
  children,
  allowedRoles,
  appKey,
  accent,
}: {
  children: ReactNode;
  allowedRoles?: Role[];
  /** i18n key of this app's title (e.g. "app_main"), shown as a badge on the login page. */
  appKey?: string;
  /** Brand accent color for the login background/badge, to visually distinguish each app. */
  accent?: string;
}) {
  const { user, loading, logout } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <div className="text-muted-foreground p-10">{t('loading')}</div>;
  }
  if (!user) return <LoginScreen allowedRoles={allowedRoles} appKey={appKey} accent={accent} />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="grid h-screen place-items-center gap-4">
        <p className="text-destructive">{t('role_denied')}</p>
        <Button variant="outline" onClick={logout}>
          {t('logout')}
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

function LoginScreen({
  allowedRoles,
  appKey,
  accent = '#4f46e5',
}: {
  allowedRoles?: Role[];
  appKey?: string;
  accent?: string;
}) {
  const { t } = useTranslation();
  const { login, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const appTitle = appKey ? t(appKey) : '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !pass.trim()) {
      setErr(t('login_err'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const user = await login(username.trim(), pass.trim());
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        setErr(t('role_denied'));
        logout();
      }
    } catch {
      setErr(t('login_failed'));
    } finally {
      setBusy(false);
    }
  }

  const tint = `color-mix(in srgb, ${accent} 8%, #ffffff)`;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-background p-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[400px] rounded-[20px] border bg-card px-8 py-[34px] shadow-[0_1px_2px_rgba(15,23,42,.04),0_12px_34px_rgba(15,23,42,.06)]"
      >
        <div className="mb-5 flex items-center gap-3">
          <div
            className="grid h-[38px] w-[38px] place-items-center rounded-[11px] text-[17px] font-bold text-white"
            style={{ background: accent }}
          >
            K
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-foreground">
              KARIER KONTROL
            </span>
            <span className="text-[11.5px] text-slate-400">{t('login_subtitle')}</span>
          </div>
        </div>

        {appTitle && (
          <span
            className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: tint, color: accent }}
          >
            {appTitle}
          </span>
        )}
        <h2 className="mb-6 text-[22px] font-semibold tracking-tight text-foreground">
          {t('login_title')}
        </h2>

        <div className="grid gap-1.5">
          <Label htmlFor="login-user">{t('login_user')}</Label>
          <Input
            id="login-user"
            className="h-11 rounded-[11px]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mt-4 grid gap-1.5">
          <Label htmlFor="login-pass">{t('login_pass')}</Label>
          <PasswordInput
            id="login-pass"
            className="h-11 rounded-[11px]"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </div>

        {err && <div className="text-destructive mt-2.5 text-sm">{err}</div>}
        <Button
          type="submit"
          disabled={busy}
          className="mt-6 h-[46px] w-full rounded-xl text-[15px] font-semibold"
        >
          {busy ? t('loading') : t('login_btn')}
        </Button>
        <div className="mt-5 flex justify-center">
          <LangSwitcher />
        </div>
      </form>
      <p className="text-xs text-slate-300">© 2026 Karier Kontrol</p>
    </div>
  );
}

/** Header profile dropdown: shows the user, opens password-change, and logs out. */
export function ProfileMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);

  if (!user) return null;
  const label = user.full_name || user.username;
  const initial = (label || '?').charAt(0).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm font-semibold outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initial}
            </span>
            <span className="text-foreground">{label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-semibold">{label}</span>
            <span className="text-muted-foreground text-xs font-normal">
              @{user.username} · {user.role}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPwOpen(true)}>
            <KeyRoundIcon />
            {t('pw_change')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={logout}>
            <LogOutIcon />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordModal open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}

function ChangePasswordModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (next !== confirm) {
      setErr(t('pw_mismatch'));
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      onOpenChange(false);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pw_change')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pw-current">{t('pw_current')}</Label>
            <PasswordInput
              id="pw-current"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pw-new">{t('pw_new')}</Label>
            <PasswordInput
              id="pw-new"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pw-confirm">{t('pw_confirm')}</Label>
            <PasswordInput
              id="pw-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {err && <div className={cn('text-destructive text-sm')}>{err}</div>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('q_cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('pw_change')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
