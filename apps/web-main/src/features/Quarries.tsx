import {
  ApiError,
  type District,
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
import { useTranslation } from '@karier/i18n';
import { Button, Card, StatusPill } from '@karier/ui';
import { type FormEvent, useMemo, useState } from 'react';

import { districtName, Field, inputStyle, Modal, selectStyle, td, th } from '../shared';

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
            style={selectStyle}
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
            style={selectStyle}
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
                  style={{ ...inputStyle, background: 'var(--soft)', color: 'var(--muted)' }}
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
                  style={inputStyle}
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

// ── overview tiles ───────────────────────────────────────────────────────────
function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card className="">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 10, height: 36, borderRadius: 6, background: accent, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--ink)',
              fontFamily: 'var(--mono)',
              lineHeight: 1.1,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stats({ quarries, districtCount }: { quarries: Quarry[]; districtCount: number }) {
  const { t } = useTranslation();
  const active = quarries.filter((q) => q.status === 'active').length;
  const suspended = quarries.length - active;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
        gap: 12,
      }}
    >
      <StatTile label={t('m_stat_total')} value={quarries.length} accent="var(--brand2)" />
      <StatTile label={t('m_stat_active')} value={active} accent="var(--green)" />
      <StatTile label={t('m_stat_suspended')} value={suspended} accent="var(--amber)" />
      <StatTile label={t('m_stat_districts')} value={districtCount} accent="#5b76c4" />
    </div>
  );
}

const PAGE_SIZE = 10;

function QuarryTable({
  search,
  districtFilter,
  districtMap,
}: {
  search: string;
  districtFilter: string;
  districtMap: Map<string, District>;
}) {
  const { t } = useTranslation();
  const { data: quarries, isLoading } = useQuarries();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Quarry | null>(null);
  const [deleting, setDeleting] = useState<Quarry | null>(null);

  if (isLoading) return <p style={{ color: 'var(--muted)', padding: 18 }}>{t('loading')}</p>;
  if (!quarries?.length) return <p style={{ color: 'var(--muted)', padding: 18 }}>{t('q_empty')}</p>;

  const q = search.trim().toLowerCase();
  const filtered = quarries.filter((it) => {
    if (districtFilter && it.district_id !== districtFilter) return false;
    if (!q) return true;
    return it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q);
  });

  if (!filtered.length) return <p style={{ color: 'var(--muted)', padding: 18 }}>{t('q_no_match')}</p>;

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11.5 }}>
              <th style={th}>{t('q_name')}</th>
              <th style={th}>{t('q_code')}</th>
              <th style={th}>{t('q_district')}</th>
              <th style={th}>{t('q_status')}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('q_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((it) => {
              const d = districtMap.get(it.district_id);
              return (
                <tr key={it.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{it.name}</td>
                  <td style={{ ...td, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{it.code}</td>
                  <td style={td}>{d ? districtName(d) : '—'}</td>
                  <td style={td}>
                    <StatusPill status={it.status === 'active' ? 'confirm' : 'flagged'} />
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Button variant="ghost" onClick={() => setEditing(it)}>
                      {t('q_edit')}
                    </Button>{' '}
                    <Button variant="ghost" onClick={() => setDeleting(it)}>
                      {t('q_delete')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 14,
          }}
        >
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {t('pg_info', { from: start + 1, to: start + slice.length, total: filtered.length })}
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

export function Quarries() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const { data: quarries } = useQuarries();
  const { data: districts } = useDistricts();

  const districtMap = useMemo(
    () => new Map((districts ?? []).map((d) => [d.id, d])),
    [districts],
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 style={{ margin: '0 0 2px', fontSize: 22 }}>{t('nav_quarries')}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>{t('main_subtitle')}</p>
      </div>

      <Stats quarries={quarries ?? []} districtCount={districts?.length ?? 0} />

      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('q_search')}
              style={{ ...inputStyle, minWidth: 240 }}
            />
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              style={{ ...selectStyle, minWidth: 150 }}
            >
              <option value="">{t('q_all_districts')}</option>
              {districts?.map((d) => (
                <option key={d.id} value={d.id}>
                  {districtName(d)}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => setModalOpen(true)}>+ {t('q_add')}</Button>
        </div>

        <QuarryTable search={search} districtFilter={districtFilter} districtMap={districtMap} />
      </Card>

      {modalOpen && <NewQuarryModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
