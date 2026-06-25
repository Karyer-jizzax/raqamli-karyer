import { useDynamics } from '@karier/api-client';
import { formatNumber, currentLang, useTranslation } from '@karier/i18n';
import { Card } from '@karier/ui';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

export function Dynamics() {
  const { t } = useTranslation();
  const lang = currentLang();
  const year = new Date().getFullYear();
  const { data, isLoading } = useDynamics({ year });

  const maxTotal = Math.max(1, ...(data?.buckets.map((b) => b.total) ?? [1]));

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <Tile label={t('dyn_total_events')} value={formatNumber(data?.total_events ?? 0, lang)} />
        <Tile label={t('dyn_avg_detection')} value={`${data?.avg_detection ?? 0}%`} />
        <Tile label={t('dyn_year')} value={String(year)} />
      </div>

      <Card>
        {isLoading ? (
          <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 240, padding: '10px 4px' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const b = data?.buckets.find((x) => x.month === m);
              const total = b?.total ?? 0;
              const h = Math.round((total / maxTotal) * 190);
              return (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                    {b ? `${b.detection_pct}%` : ''}
                  </div>
                  <div
                    title={`${total} (${b?.detection_pct ?? 0}%)`}
                    style={{
                      width: '70%',
                      height: Math.max(2, h),
                      background: 'linear-gradient(180deg,#335a82,#1d3a5c)',
                      borderRadius: '6px 6px 0 0',
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{MONTHS[m - 1]}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#15273c', fontFamily: 'var(--mono)' }}>{value}</div>
    </Card>
  );
}
