import { useDynamics } from '@karier/api-client';
import { formatNumber, currentLang, useTranslation } from '@karier/i18n';
import { Card, cn } from '@karier/ui';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

export function Dynamics() {
  const { t } = useTranslation();
  const lang = currentLang();
  const year = new Date().getFullYear();
  const { data, isLoading } = useDynamics({ year });

  const maxTotal = Math.max(1, ...(data?.buckets.map((b) => b.total) ?? [1]));

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 p-6">
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Tile label={t('dyn_total_events')} value={formatNumber(data?.total_events ?? 0, lang)} />
        <Tile label={t('dyn_avg_detection')} value={`${data?.avg_detection ?? 0}%`} accent />
        <Tile label={t('dyn_year')} value={String(year)} />
      </div>

      <Card className="px-5 py-[22px]">
        {isLoading ? (
          <p className="m-0 text-muted-foreground">{t('loading')}</p>
        ) : (
          <div className="flex h-[250px] items-end gap-3.5 px-1 py-2.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const b = data?.buckets.find((x) => x.month === m);
              const total = b?.total ?? 0;
              const h = Math.round((total / maxTotal) * 190);
              return (
                <div key={m} className="flex flex-1 flex-col items-center gap-[7px]">
                  <div className="text-[10.5px] text-slate-400 tabular-nums">
                    {b ? `${b.detection_pct}%` : ''}
                  </div>
                  <div
                    title={`${total} (${b?.detection_pct ?? 0}%)`}
                    className="w-[64%] rounded-t-[7px] bg-primary"
                    style={{ height: Math.max(2, h) }}
                  />
                  <div className="text-[11px] text-slate-500">{MONTHS[m - 1]}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="rounded-[14px] px-[18px] py-4">
      <div className="mb-2 text-xs font-medium text-slate-500">{label}</div>
      <div
        className={cn(
          'text-[28px] font-bold tracking-[-0.02em] tabular-nums',
          accent && 'text-primary',
        )}
      >
        {value}
      </div>
    </Card>
  );
}
