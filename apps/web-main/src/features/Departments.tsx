import {
  ApiError,
  type AuthUserDto,
  useCreateUser,
  useDistricts,
  useRegions,
  useUpdateUser,
  useUsers,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  UiButton as Button,
} from '@karier/ui';
import { PencilIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import {
  CountPill,
  districtName,
  Eyebrow,
  Field,
  ModalForm,
  ROW_ACTION,
  StatusDot,
  TH,
} from '../shared';

/** Radix rejects an empty <SelectItem> value, so "no district" needs a name. */
const WHOLE_REGION = '__region__';

/**
 * Where the account may look: a viloyat, and inside it either every tuman or
 * exactly one. The district is the narrower answer, so picking one is what
 * turns a regional login into a tuman login — no separate switch to forget.
 */
function ScopeSelect({
  regionId,
  districtId,
  onRegion,
  onDistrict,
}: {
  regionId: string;
  districtId: string;
  onRegion: (v: string) => void;
  onDistrict: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { data: regions } = useRegions();
  const { data: districts } = useDistricts(regionId || undefined);

  return (
    <>
      <div className="grid gap-1.5">
        <span className="text-[13px] font-medium text-slate-700">{t('dep_region')}</span>
        <Select
          value={regionId}
          onValueChange={(v) => {
            onRegion(v);
            // A tuman from the region we just left would silently outrank it.
            onDistrict('');
          }}
        >
          <SelectTrigger className="h-[42px]">
            <SelectValue placeholder={t('dep_region_ph')} />
          </SelectTrigger>
          <SelectContent>
            {(regions ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {districtName(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[13px] font-medium text-slate-700">{t('dep_district')}</span>
        <Select
          value={districtId || WHOLE_REGION}
          onValueChange={(v) => onDistrict(v === WHOLE_REGION ? '' : v)}
          disabled={!regionId}
        >
          <SelectTrigger className="h-[42px]">
            <SelectValue placeholder={t('dep_district_ph')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={WHOLE_REGION}>{t('dep_whole_region')}</SelectItem>
            {(districts ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {districtName(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[11.5px] text-slate-400">{t('dep_district_hint')}</span>
      </div>
    </>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateUser();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [regionId, setRegionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await create.mutateAsync({
        username: login.trim(),
        password,
        full_name: fullName.trim(),
        role: 'department',
        region_id: regionId || null,
        district_id: districtId || null,
      });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('dep_add')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={create.isPending}
      submitLabel={t('q_create')}
    >
      <Field label={t('dep_full_name')} value={fullName} onChange={setFullName} required={false} />
      <Field label={t('q_login')} value={login} onChange={setLogin} autoComplete="off" />
      <Field
        label={t('q_password')}
        value={password}
        onChange={setPassword}
        type="password"
        autoComplete="new-password"
      />
      <ScopeSelect
        regionId={regionId}
        districtId={districtId}
        onRegion={setRegionId}
        onDistrict={setDistrictId}
      />
    </ModalForm>
  );
}

function EditModal({ user, onClose }: { user: AuthUserDto; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateUser();
  const [login, setLogin] = useState(user.username);
  const [fullName, setFullName] = useState(user.full_name);
  const [password, setPassword] = useState('');
  const [regionId, setRegionId] = useState(user.region_id ?? '');
  const [districtId, setDistrictId] = useState(user.district_id ?? '');
  const [active, setActive] = useState(user.is_active ?? true);
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await update.mutateAsync({
        id: user.id,
        body: {
          username: login.trim(),
          full_name: fullName.trim(),
          is_active: active,
          region_id: regionId || null,
          district_id: districtId || null,
          ...(password.trim() ? { password: password.trim() } : {}),
        },
      });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('dep_edit_title')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={update.isPending}
      submitLabel={t('q_save')}
    >
      <Field label={t('q_login')} value={login} onChange={setLogin} autoComplete="off" />
      <Field label={t('dep_full_name')} value={fullName} onChange={setFullName} required={false} />
      <Field
        label={t('q_pw_new_optional')}
        value={password}
        onChange={setPassword}
        type="password"
        autoComplete="new-password"
        required={false}
      />
      <ScopeSelect
        regionId={regionId}
        districtId={districtId}
        onRegion={setRegionId}
        onDistrict={setDistrictId}
      />
      <div className="grid gap-1.5">
        <span className="text-[13px] font-medium text-slate-700">{t('q_st_active')}</span>
        <Select value={active ? 'active' : 'suspended'} onValueChange={(v) => setActive(v === 'active')}>
          <SelectTrigger className="h-[42px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t('q_st_active')}</SelectItem>
            <SelectItem value="suspended">{t('q_st_suspended')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </ModalForm>
  );
}

export function Departments() {
  const { t } = useTranslation();
  const { data: users, isLoading } = useUsers();
  const { data: regions } = useRegions();
  const { data: districts } = useDistricts();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AuthUserDto | null>(null);

  const regionLabel = (id: string | null) => {
    const r = regions?.find((x) => x.id === id);
    return r ? districtName(r) : t('dep_no_region');
  };

  // No district means the account covers the region entire — worth saying so,
  // since that is the difference between the two kinds of login.
  const districtLabel = (id: string | null | undefined) => {
    const d = districts?.find((x) => x.id === id);
    return d ? districtName(d) : t('dep_whole_region');
  };

  const departments = (users ?? []).filter((u) => u.role === 'department');
  const q = search.trim().toLowerCase();
  const filtered = departments.filter((u) => {
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q);
  });

  return (
    <div className="grid gap-5">
      <p className="text-muted-foreground text-sm">{t('dep_subtitle')}</p>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <header className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-[18px] py-4">
          <div className="flex items-center gap-[9px]">
            <Eyebrow className="text-slate-400">{t('dep_registry')}</Eyebrow>
            <CountPill>{departments.length}</CountPill>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('dep_search')}
                className="w-full pl-9 sm:w-60"
              />
            </div>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              {t('dep_add')}
            </Button>
          </div>
        </header>

        {isLoading ? (
          <p className="px-[18px] py-4 text-sm text-muted-foreground">{t('loading')}</p>
        ) : !departments.length ? (
          <p className="px-[18px] py-4 text-sm text-muted-foreground">{t('dep_empty')}</p>
        ) : !filtered.length ? (
          <p className="px-[18px] py-4 text-sm text-muted-foreground">{t('dep_no_match')}</p>
        ) : (
          <Table>
            <TableHeader className="bg-[#fbfcfe] [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>{t('dep_full_name')}</TableHead>
                <TableHead className={TH}>{t('q_login')}</TableHead>
                <TableHead className={TH}>{t('dep_region')}</TableHead>
                <TableHead className={TH}>{t('dep_district')}</TableHead>
                <TableHead className={TH}>{t('q_name')}</TableHead>
                <TableHead className={cn(TH, 'text-right')}>{t('q_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow
                  key={u.id}
                  className="border-t border-b-0 border-[#f1f5f9] hover:bg-[#f8fafc]"
                >
                  <TableCell className="px-[18px] py-[13px] text-sm font-medium">
                    {u.full_name || '—'}
                  </TableCell>
                  <TableCell className="px-[18px] py-[13px] text-[13.5px] text-[#475569] tabular-nums">
                    {u.username}
                  </TableCell>
                  <TableCell className="px-[18px] py-[13px] text-[13.5px] text-[#475569]">
                    {regionLabel(u.region_id)}
                  </TableCell>
                  <TableCell className="px-[18px] py-[13px] text-[13.5px] text-[#475569]">
                    {districtLabel(u.district_id)}
                  </TableCell>
                  <TableCell className="px-[18px] py-[13px]">
                    <StatusDot active={u.is_active ?? true} />
                  </TableCell>
                  <TableCell className="px-3.5 py-2 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={ROW_ACTION}
                        onClick={() => setEditing(u)}
                      >
                        <PencilIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} />}
      {editing && <EditModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
