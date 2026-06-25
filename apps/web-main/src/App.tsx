import { ApiError, useCreateQuarry, useDeleteQuarry, useDistricts, useHealth, useQuarries } from '@karier/api-client';
import { currentLang, useTranslation } from '@karier/i18n';
import { Button, Card, LangSwitcher, RequireAuth, StatusPill, useAuth } from '@karier/ui';
import { type FormEvent, useState } from 'react';

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

function districtName(d: { name_uz_latn: string; name_uz_cyrl: string; name_ru: string }) {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

function NewQuarryForm() {
  const { t } = useTranslation();
  const { data: districts } = useDistricts();
  const create = useCreateQuarry();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await create.mutateAsync({ name, code, district_id: districtId || districts?.[0]?.id || '' });
      setName('');
      setCode('');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <Card>
      <h3 style={{ margin: '0 0 12px' }}>{t('q_new')}</h3>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <Field label={t('q_name')} value={name} onChange={setName} />
        <Field label={t('q_code')} value={code} onChange={setCode} />
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          {t('q_district')}
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
          >
            {districts?.map((d) => (
              <option key={d.id} value={d.id}>
                {districtName(d)}
              </option>
            ))}
          </select>
        </label>
        {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        <Button type="submit" disabled={create.isPending}>
          {t('q_create')}
        </Button>
      </form>
    </Card>
  );
}

function QuarryList() {
  const { t } = useTranslation();
  const { data: quarries, isLoading } = useQuarries();
  const del = useDeleteQuarry();

  if (isLoading) return <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>;
  if (!quarries?.length) return <p style={{ color: 'var(--muted)' }}>{t('q_empty')}</p>;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {quarries.map((q) => (
        <Card key={q.id} className="">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <b>{q.name}</b>{' '}
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>
                {q.code}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusPill status={q.status === 'active' ? 'confirm' : 'flagged'} />
              <Button variant="ghost" onClick={() => del.mutate(q.id)}>
                {t('q_delete')}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Home() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div>
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
          <HealthBadge />
          <LangSwitcher />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user?.full_name || user?.username}</span>
          <Button variant="ghost" onClick={logout}>
            {t('logout')}
          </Button>
        </div>
      </header>

      <div
        style={{
          padding: 24,
          display: 'grid',
          gap: 20,
          gridTemplateColumns: '320px 1fr',
          alignItems: 'start',
          maxWidth: 1100,
        }}
      >
        <NewQuarryForm />
        <div>
          <h2 style={{ margin: '0 0 12px' }}>{t('nav_quarries')}</h2>
          <QuarryList />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
      />
    </label>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['superadmin']}>
      <Home />
    </RequireAuth>
  );
}
