import {
  ApiError,
  type District,
  type Quarry,
  useCreateQuarry,
  useCreateUser,
  useDeleteQuarry,
  useDistricts,
  useMaterials,
  useQuarries,
  useQuarryMaterials,
  useSetQuarryMaterials,
  useUpdateQuarry,
  useUpdateUser,
  useUsers,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  cn,
  getPaginationRange,
  Input,
  Label,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
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
import {
  Building2Icon,
  CameraIcon,
  CircleCheckIcon,
  type LucideIcon,
  MapIcon,
  PackageIcon,
  PauseCircleIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { districtName, Eyebrow, Field, ModalForm, slugCode, StatusDot } from '../shared';
import { QuarryPostsModal } from './QuarryPosts';

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
      const code = `${slugCode(name)}-Q${Date.now().toString().slice(-5)}`;
      const quarry = await create.mutateAsync({ name, code, district_id: district.id });
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
    <ModalForm
      title={t('q_add')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={pending}
      submitLabel={t('q_create')}
    >
      <Field label={t('q_name')} value={name} onChange={setName} />
      <Field label={t('q_login')} value={login} onChange={setLogin} autoComplete="off" />
      <Field
        label={t('q_password')}
        value={password}
        onChange={setPassword}
        type="password"
        autoComplete="new-password"
      />
      <div className="grid gap-1.5">
        <Label>{t('q_district')}</Label>
        <Select value={districtId} onValueChange={setDistrictId}>
          <SelectTrigger>
            <SelectValue placeholder={t('q_district')} />
          </SelectTrigger>
          <SelectContent>
            {districts?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {districtName(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ModalForm>
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
    <ModalForm
      title={t('q_edit_title')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={pending}
      submitLabel={t('q_save')}
    >
      <Field label={t('q_name')} value={name} onChange={setName} />
      <div className="grid gap-1.5">
        <Label>{t('q_status')}</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'suspended')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t('q_st_active')}</SelectItem>
            <SelectItem value="suspended">{t('q_st_suspended')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-1 border-t pt-3">
        <div className="text-muted-foreground mb-2 text-xs font-semibold">{t('q_operator')}</div>
        {operator ? (
          <div className="grid gap-2.5">
            <Field label={t('q_login')} value={operator.username} readOnly required={false} />
            <div className="grid gap-1.5">
              <Label htmlFor="op-pw">{t('q_pw_new_optional')}</Label>
              <Input
                id="op-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••"
              />
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">{t('q_no_operator')}</div>
        )}
      </div>
    </ModalForm>
  );
}

function ConfirmDeleteModal({ quarry, onClose }: { quarry: Quarry; onClose: () => void }) {
  const { t } = useTranslation();
  const del = useDeleteQuarry();
  const [err, setErr] = useState('');

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await del.mutateAsync(quarry.id);
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('q_delete_title')}
      onClose={onClose}
      onSubmit={onConfirm}
      err={err}
      pending={del.isPending}
      submitLabel={t('q_yes')}
      cancelLabel={t('q_no')}
    >
      <p className="text-sm">{t('q_delete_confirm', { name: quarry.name })}</p>
    </ModalForm>
  );
}

function QuarryMaterialsModal({ quarry, onClose }: { quarry: Quarry; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: allMaterials } = useMaterials();
  const { data: assigned, isLoading } = useQuarryMaterials(quarry.id);
  const setMaterials = useSetQuarryMaterials();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (assigned && selected === null) setSelected(new Set(assigned.map((m) => m.id)));
  }, [assigned, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await setMaterials.mutateAsync({
        quarryId: quarry.id,
        materialIds: Array.from(selected ?? []),
      });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('mat_link_title', { name: quarry.name })}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={setMaterials.isPending}
      submitLabel={t('q_save')}
    >
      {isLoading || selected === null ? (
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      ) : !allMaterials?.length ? (
        <p className="text-muted-foreground text-sm">{t('mat_empty')}</p>
      ) : (
        <div className="grid gap-2">
          {allMaterials.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                className="size-4 accent-primary"
              />
              {districtName(m)}
              <span className="font-mono text-[11px] text-muted-foreground">{m.id}</span>
            </label>
          ))}
        </div>
      )}
    </ModalForm>
  );
}

// ── telemetry strip ──────────────────────────────────────────────────────────
// The signature element: the four headline figures read as a single instrument
// panel — hairline-divided channels, uppercase labels, monospace tabular figures.
function Metric({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5" style={{ color }} />
        <Eyebrow className="text-muted-foreground">{label}</Eyebrow>
      </div>
      <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      <span className="h-0.5 w-8 rounded-full" style={{ background: color }} aria-hidden />
    </div>
  );
}

function Stats({ quarries, districtCount }: { quarries: Quarry[]; districtCount: number }) {
  const { t } = useTranslation();
  const active = quarries.filter((q) => q.status === 'active').length;
  const suspended = quarries.length - active;
  return (
    <div className="overflow-hidden rounded-xl border bg-border shadow-sm">
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
        <Metric label={t('m_stat_total')} value={quarries.length} icon={Building2Icon} color="#3b6ea5" />
        <Metric label={t('m_stat_active')} value={active} icon={CircleCheckIcon} color="#13935f" />
        <Metric label={t('m_stat_suspended')} value={suspended} icon={PauseCircleIcon} color="#b9831a" />
        <Metric label={t('m_stat_districts')} value={districtCount} icon={MapIcon} color="#4f46e5" />
      </div>
    </div>
  );
}

const TH = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground';

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
  const [linking, setLinking] = useState<Quarry | null>(null);
  const [managingPosts, setManagingPosts] = useState<Quarry | null>(null);

  if (isLoading) return <p className="text-muted-foreground p-4">{t('loading')}</p>;
  if (!quarries?.length) return <p className="text-muted-foreground p-4">{t('q_empty')}</p>;

  const q = search.trim().toLowerCase();
  const filtered = quarries.filter((it) => {
    if (districtFilter && it.district_id !== districtFilter) return false;
    if (!q) return true;
    return it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q);
  });

  if (!filtered.length) return <p className="text-muted-foreground p-4">{t('q_no_match')}</p>;

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div>
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className={TH}>{t('q_name')}</TableHead>
            <TableHead className={TH}>{t('q_district')}</TableHead>
            <TableHead className={TH}>{t('q_status')}</TableHead>
            <TableHead className={cn(TH, 'text-right')}>{t('q_actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((it) => {
            const d = districtMap.get(it.district_id);
            return (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.name}</TableCell>
                <TableCell>{d ? districtName(d) : '—'}</TableCell>
                <TableCell>
                  <StatusDot active={it.status === 'active'} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('mat_link_title', { name: it.name })}
                      onClick={() => setLinking(it)}
                    >
                      <PackageIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('q_posts_manage', { name: it.name })}
                      onClick={() => setManagingPosts(it)}
                    >
                      <CameraIcon />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(it)}>
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(it)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {t('pg_info', { from: start + 1, to: start + slice.length, total: filtered.length })}
          </span>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-label={t('pg_prev')}
                  disabled={current <= 1}
                  onClick={() => setPage(current - 1)}
                />
              </PaginationItem>
              {getPaginationRange(current, pageCount).map((p, i) =>
                p === 'ellipsis' ? (
                  <PaginationItem key={`e${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink isActive={p === current} onClick={() => setPage(p)}>
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  aria-label={t('pg_next')}
                  disabled={current >= pageCount}
                  onClick={() => setPage(current + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {editing && <EditQuarryModal quarry={editing} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDeleteModal quarry={deleting} onClose={() => setDeleting(null)} />}
      {linking && <QuarryMaterialsModal quarry={linking} onClose={() => setLinking(null)} />}
      {managingPosts && (
        <QuarryPostsModal quarry={managingPosts} onClose={() => setManagingPosts(null)} />
      )}
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
    <div className="grid gap-5">
      <p className="text-muted-foreground text-sm">{t('main_subtitle')}</p>

      <Stats quarries={quarries ?? []} districtCount={districts?.length ?? 0} />

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Eyebrow className="text-muted-foreground">{t('m_registry')}</Eyebrow>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
              {quarries?.length ?? 0}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('q_search')}
                className="w-full pl-9 sm:w-60"
              />
            </div>
            <Select
              value={districtFilter || 'all'}
              onValueChange={(v) => setDistrictFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('q_all_districts')}</SelectItem>
                {districts?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {districtName(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setModalOpen(true)}>
              <PlusIcon />
              {t('q_add')}
            </Button>
          </div>
        </header>

        <QuarryTable search={search} districtFilter={districtFilter} districtMap={districtMap} />
      </div>

      {modalOpen && <NewQuarryModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
