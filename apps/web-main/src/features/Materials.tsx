import {
  ApiError,
  type Material,
  useCreateMaterial,
  useDeleteMaterial,
  useMaterials,
  useUpdateMaterial,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  cn,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  UiButton as Button,
} from '@karier/ui';
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import {
  CountPill,
  districtName,
  Eyebrow,
  Field,
  ModalForm,
  ROW_ACTION,
  ROW_ACTION_DANGER,
} from '../shared';

type MaterialForm = {
  id: string;
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
  default_density: string;
  density_min: string;
  density_max: string;
  is_tent: boolean;
};

const emptyForm: MaterialForm = {
  id: '',
  name_uz_latn: '',
  name_uz_cyrl: '',
  name_ru: '',
  default_density: '',
  density_min: '',
  density_max: '',
  is_tent: false,
};

function formOf(m: Material): MaterialForm {
  return {
    id: m.id,
    name_uz_latn: m.name_uz_latn,
    name_uz_cyrl: m.name_uz_cyrl,
    name_ru: m.name_ru,
    default_density: String(m.default_density),
    density_min: String(m.density_min),
    density_max: String(m.density_max),
    is_tent: m.is_tent,
  };
}

function MaterialModal({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateMaterial();
  const update = useUpdateMaterial();
  const [f, setF] = useState<MaterialForm>(material ? formOf(material) : emptyForm);
  const [err, setErr] = useState('');
  const set = (k: keyof MaterialForm) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const body = {
      name_uz_latn: f.name_uz_latn,
      name_uz_cyrl: f.name_uz_cyrl,
      name_ru: f.name_ru,
      default_density: Number(f.default_density),
      density_min: Number(f.density_min),
      density_max: Number(f.density_max),
      is_tent: f.is_tent,
    };
    try {
      if (material) await update.mutateAsync({ id: material.id, body });
      else await create.mutateAsync({ id: f.id.trim(), ...body });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={material ? t('mat_edit_title') : t('mat_add')}
      onClose={onClose}
      onSubmit={onSubmit}
      err={err}
      pending={pending}
      submitLabel={material ? t('q_save') : t('q_create')}
    >
      <Field
        label={t('mat_id')}
        value={f.id}
        onChange={set('id')}
        readOnly={!!material}
        autoComplete="off"
      />
      <Field label={t('geo_name_latn')} value={f.name_uz_latn} onChange={set('name_uz_latn')} />
      <Field label={t('geo_name_cyrl')} value={f.name_uz_cyrl} onChange={set('name_uz_cyrl')} />
      <Field label={t('geo_name_ru')} value={f.name_ru} onChange={set('name_ru')} />
      <div className="grid grid-cols-3 gap-2.5">
        <Field
          label={t('mat_density_default')}
          value={f.default_density}
          onChange={set('default_density')}
          type="number"
        />
        <Field
          label={t('mat_density_min')}
          value={f.density_min}
          onChange={set('density_min')}
          type="number"
        />
        <Field
          label={t('mat_density_max')}
          value={f.density_max}
          onChange={set('density_max')}
          type="number"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={f.is_tent}
          onChange={(e) => setF((p) => ({ ...p, is_tent: e.target.checked }))}
          className="size-4 accent-primary"
        />
        {t('mat_is_tent')}
      </label>
    </ModalForm>
  );
}

function ConfirmDeleteModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { t } = useTranslation();
  const del = useDeleteMaterial();
  const [err, setErr] = useState('');

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await del.mutateAsync(material.id);
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('mat_delete_title')}
      onClose={onClose}
      onSubmit={onConfirm}
      err={err}
      pending={del.isPending}
      submitLabel={t('q_yes')}
      cancelLabel={t('q_no')}
    >
      <p className="text-sm">{t('mat_delete_confirm', { name: districtName(material) })}</p>
    </ModalForm>
  );
}

const TH =
  'h-auto px-[18px] py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400';

export function Materials() {
  const { t } = useTranslation();
  const { data: materials, isLoading } = useMaterials();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = (materials ?? []).filter((m) => {
    if (!q) return true;
    return (
      m.id.toLowerCase().includes(q) ||
      m.name_uz_latn.toLowerCase().includes(q) ||
      m.name_ru.toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid gap-5">
      <p className="text-muted-foreground text-sm">{t('mat_subtitle')}</p>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <header className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-[18px] py-4">
          <div className="flex items-center gap-[9px]">
            <Eyebrow className="text-slate-400">{t('mat_registry')}</Eyebrow>
            <CountPill>{materials?.length ?? 0}</CountPill>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('mat_search')}
                className="w-full pl-9 sm:w-60"
              />
            </div>
            <Button onClick={() => setModalOpen(true)}>
              <PlusIcon />
              {t('mat_add')}
            </Button>
          </div>
        </header>

        {isLoading ? (
          <p className="px-[18px] py-4 text-sm text-muted-foreground">{t('loading')}</p>
        ) : !materials?.length ? (
          <p className="px-[18px] py-4 text-sm text-muted-foreground">{t('mat_empty')}</p>
        ) : !filtered.length ? (
          <p className="px-[18px] py-4 text-sm text-muted-foreground">{t('mat_no_match')}</p>
        ) : (
          <Table>
            <TableHeader className="bg-[#fbfcfe] [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>{t('mat_id')}</TableHead>
                <TableHead className={TH}>{t('q_name')}</TableHead>
                <TableHead className={TH}>{t('mat_density_default')}</TableHead>
                <TableHead className={TH}>{t('mat_is_tent')}</TableHead>
                <TableHead className={cn(TH, 'text-right')}>{t('q_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow
                  key={m.id}
                  className="border-t border-b-0 border-[#f1f5f9] hover:bg-[#f8fafc]"
                >
                  <TableCell className="px-[18px] py-[13px] text-[12.5px] text-slate-400 tabular-nums">
                    {m.id}
                  </TableCell>
                  <TableCell className="px-[18px] py-[13px] text-sm font-medium">
                    {districtName(m)}
                  </TableCell>
                  <TableCell className="px-[18px] py-[13px] text-[13.5px] text-[#475569] tabular-nums">
                    {m.default_density} ({m.density_min}–{m.density_max})
                  </TableCell>
                  <TableCell className="px-[18px] py-[13px] text-[13.5px] text-[#475569]">
                    {m.is_tent ? t('q_yes') : t('q_no')}
                  </TableCell>
                  <TableCell className="px-3.5 py-2 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={ROW_ACTION}
                        onClick={() => setEditing(m)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={ROW_ACTION_DANGER}
                        onClick={() => setDeleting(m)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {modalOpen && <MaterialModal material={null} onClose={() => setModalOpen(false)} />}
      {editing && <MaterialModal material={editing} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDeleteModal material={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
