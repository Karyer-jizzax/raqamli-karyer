import { useEvents } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import type { StatusKey } from '@karier/types';
import { Button, ProtocolViewer, StatusPill } from '@karier/ui';
import { useState } from 'react';

const th =
  'px-5 py-[13px] text-left text-[11px] font-semibold tracking-[0.07em] uppercase text-slate-400';

export function EventList() {
  const { t } = useTranslation();
  const { data: events, isLoading } = useEvents();
  const [protoEvent, setProtoEvent] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted-foreground">{t('loading')}</p>;
  if (!events?.length) return <p className="text-muted-foreground">{t('ev_empty')}</p>;

  return (
    <div className="overflow-hidden rounded-[18px] border bg-card">
      {protoEvent && <ProtocolViewer eventId={protoEvent} onClose={() => setProtoEvent(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-[#fbfcfe]">
              <th className={th}>{t('ev_plate_number')}</th>
              <th className={th}>{t('ev_model')}</th>
              <th className={th}>{t('ev_vol_final')}</th>
              <th className={th}>{t('ev_conf')}</th>
              <th className={th}>{t('q_status')}</th>
              <th className="px-5 py-[13px]"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc]">
                <td className="px-5 py-[15px] text-[15px] font-semibold tabular-nums">
                  {e.plate_region} {e.plate_number}
                </td>
                <td className="px-5 py-[15px] text-[14.5px] text-slate-600">{e.model}</td>
                <td className="px-5 py-[15px] text-[14.5px] tabular-nums">{e.volume_final} m³</td>
                <td className="px-5 py-[15px] text-[14.5px] text-slate-600 tabular-nums">
                  {e.volume_confidence}%
                </td>
                <td className="px-5 py-[15px]">
                  <StatusPill status={e.status as StatusKey} />
                </td>
                <td className="px-5 py-[11px] text-right">
                  <Button
                    variant="outline"
                    onClick={() => setProtoEvent(e.id)}
                    className="h-[38px] rounded-[10px] border-[#e2e8f0] px-[15px] text-[13.5px] font-semibold text-primary"
                  >
                    {t('protocol_open')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
