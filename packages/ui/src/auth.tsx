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
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button, LangSwitcher } from './components';

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
    return <div style={{ padding: 40, color: 'var(--muted)' }}>{t('loading')}</div>;
  }
  if (!user) return <LoginScreen allowedRoles={allowedRoles} appKey={appKey} accent={accent} />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', gap: 14 }}>
        <p style={{ color: 'var(--red)' }}>{t('role_denied')}</p>
        <Button variant="ghost" onClick={logout}>
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
  accent = '#1d3a5c',
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: `linear-gradient(140deg, ${accent} 0%, ${accent}cc 45%, ${accent}88)`,
        padding: 20,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '36px 34px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 24px 60px rgba(8,25,50,.4)',
          borderTop: `5px solid ${accent}`,
        }}
      >
        {appTitle && (
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 999,
              background: `${accent}1a`,
              color: accent,
              fontSize: 12.5,
              fontWeight: 700,
              marginBottom: 14,
              letterSpacing: 0.2,
            }}
          >
            {appTitle}
          </div>
        )}
        <h2 style={{ margin: '0 0 4px', color: '#15273c' }}>{t('login_title')}</h2>
        <p style={{ margin: '0 0 22px', color: 'var(--muted)', fontSize: 13 }}>
          {t('login_subtitle')}
        </p>
        <label style={lbl}>{t('login_user')}</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} autoFocus />
        <label style={{ ...lbl, marginTop: 12 }}>{t('login_pass')}</label>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} style={inputStyle} />
        {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 9 }}>{err}</div>}
        <Button type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, opacity: busy ? 0.7 : 1 }}>
          {busy ? t('loading') : t('login_btn')}
        </Button>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <LangSwitcher />
        </div>
      </form>
    </div>
  );
}

/** Header profile dropdown: shows the user, opens password-change, and logs out. */
export function ProfileMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;
  const label = user.full_name || user.username;
  const initial = (label || '?').charAt(0).toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px 5px 6px',
          border: '1px solid var(--line)',
          borderRadius: 999,
          background: '#fff',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--brand)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {initial}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#23364a' }}>{label}</span>
        <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,.16)',
            minWidth: 200,
            overflow: 'hidden',
            zIndex: 40,
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#23364a' }}>{label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              @{user.username} · {user.role}
            </div>
          </div>
          <button
            style={menuItemStyle}
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
          >
            {t('pw_change')}
          </button>
          <button
            style={{ ...menuItemStyle, color: 'var(--red)' }}
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            {t('logout')}
          </button>
        </div>
      )}

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
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
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '9vh 16px',
        zIndex: 60,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 400,
          padding: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,.28)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{t('pw_change')}</h3>
        <label style={lbl}>{t('pw_current')}</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          style={inputStyle}
          autoComplete="current-password"
          required
          autoFocus
        />
        <label style={{ ...lbl, marginTop: 12 }}>{t('pw_new')}</label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          style={inputStyle}
          autoComplete="new-password"
          required
        />
        <label style={{ ...lbl, marginTop: 12 }}>{t('pw_confirm')}</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          autoComplete="new-password"
          required
        />
        {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 9 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t('q_cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('pw_change')}
          </Button>
        </div>
      </form>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  color: '#23364a',
};

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#5a6b7e' };
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  border: '1px solid var(--line)',
  borderRadius: 10,
  fontSize: 14,
  marginTop: 5,
  fontFamily: 'inherit',
};
