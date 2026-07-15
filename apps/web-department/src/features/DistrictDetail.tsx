import { type CargoPost, useDistrictCargo, useDistricts, useRegions } from '@karier/api-client';
import { currentLang, formatDateTime, formatNumber, useTranslation } from '@karier/i18n';
import { Card, cn } from '@karier/ui';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function name(d: { name_ru: string; name_uz_cyrl: string; name_uz_latn: string }): string {
  const l = currentLang();
  return l === 'ru' ? d.name_ru : l === 'uz-cyrl' ? d.name_uz_cyrl : d.name_uz_latn;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const DEFAULT_RANGE = {
  from: `${new Date().getFullYear()}-01-01`,
  to: isoDay(new Date()),
};

const DATE_INPUT =
  'h-[38px] rounded-[9px] border border-input bg-white px-[11px] text-[13px] font-[inherit]';

const IconHome = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9.5 10 3l7 6.5" />
    <path d="M5 8.5V16a1 1 0 0 0 1 1h3v-4.5h2V17h3a1 1 0 0 0 1-1V8.5" />
  </svg>
);
const IconEvents = (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
    <path d="M3 15l4-5 4 3 6-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconTruck = (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
    <rect x="1" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 8h4l3 3v2h-7V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="5" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="15" cy="15" r="1.6" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

function EcoPostCard({
  post,
  t,
  lang,
}: {
  post: CargoPost;
  t: (k: string) => string;
  lang: ReturnType<typeof currentLang>;
}) {
  return (
    <div className="min-w-[132px] shrink-0 rounded-[10px] border bg-white px-3 py-2.5">
      <div className="mb-2 inline-block rounded-full bg-primary-tint px-2 py-0.5 text-[11.5px] font-bold text-primary tabular-nums">
        {post.code}
      </div>
      <div className="mb-[3px] flex items-center gap-[5px] text-[12.5px] text-foreground">
        <span className="flex text-primary">{IconEvents}</span>
        <b className="tabular-nums">{formatNumber(post.events, lang)}</b>
      </div>
      <div className="mb-2 flex items-center gap-[5px] text-[12.5px] text-foreground">
        <span className="flex text-primary">{IconTruck}</span>
        <b className="tabular-nums">{formatNumber(post.trucks, lang)}</b>
      </div>
      <div className="mb-1 text-[11px] text-muted-foreground">{t('dash_cameras')}:</div>
      <div className="flex gap-1">
        {Array.from({ length: post.cameras }, (_, i) => (
          <span
            key={i}
            className={cn(
              'inline-block size-[9px] rounded-full',
              i < post.cameras_active ? 'bg-[#059669]' : 'bg-[#e11d48]',
            )}
          />
        ))}
      </div>
    </div>
  );
}

function CargoTable({
  t,
  fn,
  rows,
  onRowClick,
}: {
  t: (k: string) => string;
  fn: (v: number) => string;
  rows: { id: string; label: string; count: number; volume: number }[];
  onRowClick?: (id: string) => void;
}) {
  const th = 'border-b px-2 py-1 text-center text-[11px] font-bold text-muted-foreground';
  const td = 'border-b border-b-[#f1f5f9] p-2 text-[13px]';
  const tdNum = cn(td, 'text-center font-bold tabular-nums');
  const tdMuted = cn(td, 'text-center font-normal text-muted-foreground tabular-nums');

  return (
    <table className="mt-1.5 w-full border-collapse">
      <thead>
        <tr>
          <th className={th} />
          <th className={th} colSpan={2}>
            {t('dash_ettyu')}
          </th>
          <th className={th} colSpan={2}>
            {t('dash_diff')}
          </th>
        </tr>
        <tr>
          <th className={th} />
          <th className={th}>{t('rep_count')}</th>
          <th className={th}>{t('rep_vol')}</th>
          <th className={th}>{t('rep_count')}</th>
          <th className={th}>{t('rep_vol')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            onClick={onRowClick ? () => onRowClick(r.id) : undefined}
            title={onRowClick ? t('q_open_hint') : undefined}
            className={cn(onRowClick && 'cursor-pointer hover:bg-[#f6fefd]')}
          >
            <td
              className={cn(
                td,
                'font-semibold',
                onRowClick ? 'text-primary underline' : 'text-foreground',
              )}
            >
              {r.label}
            </td>
            <td className={tdNum}>{fn(r.count)}</td>
            <td className={tdNum}>{fn(r.volume)}</td>
            <td className={tdMuted}>-</td>
            <td className={tdMuted}>-</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-[9px]',
        danger ? 'bg-[#fff1f2]' : 'bg-slate-50',
      )}
    >
      <span className={cn('text-[12.5px]', danger ? 'text-[#e11d48]' : 'text-muted-foreground')}>
        {label}:
      </span>
      <b className={cn('text-sm tabular-nums', danger ? 'text-[#e11d48]' : 'text-foreground')}>
        {value}
      </b>
    </div>
  );
}

export function DistrictDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { districtId } = useParams<{ districtId: string }>();
  const lang = currentLang();

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();

  const [range, setRange] = useState(DEFAULT_RANGE);
  const { data: cargo } = useDistrictCargo(districtId, {
    date_from: range.from || undefined,
    date_to: range.to || undefined,
  });

  const district = districts?.find((d) => d.id === districtId);
  const region = regions?.find((r) => r.id === district?.region_id);
  const posts = cargo?.posts ?? [];
  const quarryCargoRows = useMemo(
    () =>
      (cargo?.quarries ?? []).map((q) => ({
        id: q.id,
        label: q.name,
        count: q.count,
        volume: q.volume,
      })),
    [cargo?.quarries],
  );

  const fn = (v: number | undefined) => formatNumber(v ?? 0, lang);
  const regionName = region ? name(region) : '';
  const districtDisplayName = district ? name(district) : t('loading');
  const updatedAt = cargo?.last_event_at ? formatDateTime(cargo.last_event_at) : '—';

  return (
    <div className="mx-auto flex max-w-[1160px] flex-col gap-4 p-6">
      {/* Title */}
      <h1 className="m-0 text-center text-base font-semibold text-foreground">
        {t('dash_detail_title', { region: regionName, district: districtDisplayName })}
      </h1>

      {/* Date range + breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className={DATE_INPUT}
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className={DATE_INPUT}
          />
        </div>
        <div className="flex items-center gap-2 text-[12.5px]">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            title={t('dash_back')}
            className="grid size-7 cursor-pointer place-items-center rounded-lg border border-[#e2e8f0] bg-white text-primary"
          >
            {IconHome}
          </button>
          <span className="text-muted-foreground">{regionName}</span>
          <span className="text-muted-foreground">/</span>
          <b className="text-foreground">{districtDisplayName}</b>
        </div>
      </div>
      <div className="-mt-2 text-right text-xs text-muted-foreground">
        {t('as_updated')}: <b className="text-[#0f766e]">{updatedAt}</b>
      </div>

      {/* Eco-post cards strip */}
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {posts.map((p) => (
          <EcoPostCard key={p.id} post={p} t={t} lang={lang} />
        ))}
        {posts.length === 0 && (
          <p className="m-0 text-[13px] text-muted-foreground">{t('q_empty')}</p>
        )}
      </div>

      {/* Jami + cargo breakdown */}
      <div className="grid items-start gap-4 md:grid-cols-[280px_1fr]">
        <Card>
          <div className="mb-2.5 flex items-center gap-2 border-b border-b-[#f1f5f9] pb-2.5">
            <span className="inline-block size-2 rounded-full bg-primary" />
            <span className="text-[13px] font-bold text-foreground">{t('jami')}</span>
            <span className="ml-auto text-[17px] font-bold text-foreground tabular-nums">
              {fn(posts.reduce((s, p) => s + p.trucks, 0))}
            </span>
          </div>
          <div className="grid gap-2.5">
            {posts.map((p) => (
              <div key={p.code} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block size-[9px] rounded-full border-[1.5px]" />
                  <span className="text-[13px] font-semibold text-foreground">{p.code}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <b className="text-[13.5px] text-[#0f766e] tabular-nums">{fn(p.trucks)}</b>
                  <span className="flex text-primary">{IconTruck}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-[15px] font-semibold text-foreground">
            {t('dash_cargo_info')}{' '}
            <span className="text-[12.5px] font-normal text-muted-foreground">
              ({t('dash_trucks_plural')})
            </span>
          </h3>

          <div className="mb-3">
            <span className="text-[13.5px] text-muted-foreground">{t('dash_trucks_total')}: </span>
            <b className="text-[19px] text-[#0f766e] tabular-nums">{fn(cargo?.trucks_total)}</b>
          </div>

          {quarryCargoRows.length > 0 ? (
            <CargoTable
              t={t}
              fn={fn}
              rows={quarryCargoRows}
              onRowClick={(id) => navigate(`/dashboard/districts/${districtId}/quarries/${id}`)}
            />
          ) : (
            <p className="mt-2.5 mb-0 text-[13px] text-muted-foreground">{t('q_empty')}</p>
          )}

          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <StatBox label={t('dash_unidentified')} value={fn(cargo?.unidentified)} danger />
          </div>
        </Card>
      </div>
    </div>
  );
}
