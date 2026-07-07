import { useEvents } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { Card, ProtocolViewer, StatusPill } from '@karier/ui';
import { useState } from 'react';

const TH =
  'px-[18px] py-3 text-left text-[10.5px] font-semibold tracking-[.08em] uppercase text-slate-400';

export function Protocols() {
  const { t } = useTranslation();
  const { data: events, isLoading } = useEvents();
  const [protoEvent, setProtoEvent] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[900px] p-6">
      {protoEvent && <ProtocolViewer eventId={protoEvent} onClose={() => setProtoEvent(null)} />}
      <h2 className="mb-3.5 text-[17px] font-semibold">{t('nav_protocol')}</h2>
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <p className="m-0 p-5 text-muted-foreground">{t('loading')}</p>
        ) : !events?.length ? (
          <p className="m-0 p-5 text-muted-foreground">{t('ev_empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#fbfcfe]">
                  <th className={TH}>{t('ev_plate_number')}</th>
                  <th className={TH}>{t('ev_vol_final')}</th>
                  <th className={TH}>{t('q_status')}</th>
                  <th className="px-[18px] py-3" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-t-[#f1f5f9]">
                    <td className="px-[18px] py-[13px] text-[13.5px] font-medium tabular-nums">
                      {e.plate_region} {e.plate_number}
                    </td>
                    <td className="px-[18px] py-[13px] text-[13.5px] text-[#475569] tabular-nums">
                      {e.volume_final} m³
                    </td>
                    <td className="px-[18px] py-[13px]">
                      <StatusPill status={e.status} />
                    </td>
                    <td className="px-[18px] py-[9px] text-right">
                      <button
                        onClick={() => setProtoEvent(e.id)}
                        className="h-[34px] cursor-pointer rounded-[9px] border border-[#e2e8f0] bg-white px-3.5 text-[13px] font-semibold text-primary"
                      >
                        {t('protocol_open')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
