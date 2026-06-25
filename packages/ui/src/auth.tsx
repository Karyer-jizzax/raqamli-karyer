import {
  type AuthUserDto,
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
}: {
  children: ReactNode;
  allowedRoles?: Role[];
}) {
  const { user, loading, logout } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--muted)' }}>{t('loading')}</div>;
  }
  if (!user) return <LoginScreen allowedRoles={allowedRoles} />;
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

function LoginScreen({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { t } = useTranslation();
  const { login, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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
        background: 'linear-gradient(140deg,#122740,#1d3a5c 45%,#335a82)',
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
        }}
      >
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
