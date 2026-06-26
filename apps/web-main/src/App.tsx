import {
  ApiError,
  type Quarry,
  useCreateQuarry,
  useCreateUser,
  useDeleteQuarry,
  useDistricts,
  useQuarries,
  useUpdateQuarry,
  useUpdateUser,
  useUsers,
} from '@karier/api-client';
import { currentLang, useTranslation } from '@karier/i18n';
import { Button, Card, LangSwitcher, ProfileMenu, RequireAuth, StatusPill } from '@karier/ui';
import { type FormEvent, type ReactNode, useState } from 'react';

function districtName(d: { name_uz_latn: string; name_uz_cyrl: string; name_ru: string }) {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '9vh 16px',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

function NewQuarryModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: districts } = useDistricts();
  const create = useCreateQuarry();
  const createUser = useCreateUser();
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [err, setErr] = useState('');

  const pending = create.isPending || createUser.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const district = districts?.find((d) => d.id === districtId) ?? districts?.[0];
    if (!district) {
      setErr('Tuman tanlang');
      return;
    }
    try {
      // 1. Create the quarry (code auto-derived from the district code).
      const code = `${district.code}-Q${Date.now().toString().slice(-5)}`;
      const quarry = await create.mutateAsync({ name, code, district_id: district.id });
      // 2. Create the operator account bound to that quarry.
      await createUser.mutateAsync({
        username: login,
        password,
        full_name: name,
        role: 'operator',
        quarry_id: quarry.id,
      });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <Modal title={t('q_add')} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <Field label={t('q_name')} value={name} onChange={setName} />
        <Field label={t('q_login')} value={login} onChange={setLogin} autoComplete="off" />
        <Field
          label={t('q_password')}
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete="new-password"
        />
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t('q_cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {t('q_create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditQuarryModal({ quarry, onClose }: { quarry: Quarry; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateQuarry();
  const updateUser = useUpdateUser();
  const { data: users } = useUsers({ quarry_id: quarry.id });
  const operator = users?.find((u) => u.role === 'operator') ?? users?.[0];
  const [name, setName] = useState(quarry.name);
  const [status, setStatus] = useState<'active' | 'suspended'>(
    quarry.status === 'suspended' ? 'suspended' : 'active',
  );
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const pending = update.isPending || updateUser.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await update.mutateAsync({ id: quarry.id, body: { name, status } });
      if (operator && password.trim()) {
        await updateUser.mutateAsync({ id: operator.id, body: { password: password.trim() } });
      }
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <Modal title={t('q_edit_title')} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <Field label={t('q_name')} value={name} onChange={setName} />
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          {t('q_status')}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')}
            style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
          >
            <option value="active">{t('q_st_active')}</option>
            <option value="suspended">{t('q_st_suspended')}</option>
          </select>
        </label>

        <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0 0', paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5a6b7e', marginBottom: 8 }}>
            {t('q_operator')}
          </div>
          {operator ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                {t('q_login')}
                <input
                  value={operator.username}
                  readOnly
                  style={{
                    padding: '9px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    background: 'var(--bg, #f6f8fa)',
                    color: 'var(--muted)',
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                {t('q_pw_new_optional')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••"
                  style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
                />
              </label>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('q_no_operator')}</div>
          )}
        </div>

        {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t('q_cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {t('q_save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmDeleteModal({ quarry, onClose }: { quarry: Quarry; onClose: () => void }) {
  const { t } = useTranslation();
  const del = useDeleteQuarry();
  const [err, setErr] = useState('');

  async function onConfirm() {
    setErr('');
    try {
      await del.mutateAsync(quarry.id);
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <Modal title={t('q_delete_title')} onClose={onClose}>
      <p style={{ margin: '0 0 16px', fontSize: 14 }}>{t('q_delete_confirm', { name: quarry.name })}</p>
      {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="ghost" onClick={onClose} disabled={del.isPending}>
          {t('q_no')}
        </Button>
        <Button onClick={onConfirm} disabled={del.isPending}>
          {t('q_yes')}
        </Button>
      </div>
    </Modal>
  );
}

const PAGE_SIZE = 10;

function QuarryList({ search }: { search: string }) {
  const { t } = useTranslation();
  const { data: quarries, isLoading } = useQuarries();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Quarry | null>(null);
  const [deleting, setDeleting] = useState<Quarry | null>(null);

  if (isLoading) return <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>;
  if (!quarries?.length) return <p style={{ color: 'var(--muted)' }}>{t('q_empty')}</p>;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? quarries.filter(
        (it) => it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q),
      )
    : quarries;

  if (!filtered.length) return <p style={{ color: 'var(--muted)' }}>{t('q_no_match')}</p>;

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {slice.map((it) => (
        <Card key={it.id} className="">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <b>{it.name}</b>{' '}
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>
                {it.code}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusPill status={it.status === 'active' ? 'confirm' : 'flagged'} />
              <Button variant="ghost" onClick={() => setEditing(it)}>
                {t('q_edit')}
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(it)}>
                {t('q_delete')}
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {pageCount > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 6,
          }}
        >
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {t('pg_info', {
              from: start + 1,
              to: start + slice.length,
              total: filtered.length,
            })}
          </span>
          <Button variant="ghost" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            {t('pg_prev')}
          </Button>
          <Button variant="ghost" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
            {t('pg_next')}
          </Button>
        </div>
      )}

      {editing && <EditQuarryModal quarry={editing} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDeleteModal quarry={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}

function Home() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

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
          <LangSwitcher />
          <ProfileMenu />
        </div>
      </header>

      <div style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0 }}>{t('nav_quarries')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('q_search')}
              style={{
                padding: '9px 12px',
                border: '1px solid var(--line)',
                borderRadius: 8,
                minWidth: 260,
              }}
            />
            <Button onClick={() => setModalOpen(true)}>+ {t('q_add')}</Button>
          </div>
        </div>
        <QuarryList search={search} />
      </div>

      {modalOpen && <NewQuarryModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        required
        style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
      />
    </label>
  );
}

export function App() {
  return (
    <RequireAuth allowedRoles={['superadmin']} appKey="app_main" accent="#1d3a5c">
      <Home />
    </RequireAuth>
  );
}
