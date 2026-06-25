import { useEvents } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { Card, ProtocolViewer, StatusPill } from '@karier/ui';
import { useState } from 'react';

export function Protocols() {
  const { t } = useTranslation();
  const { data: events, isLoading } = useEvents();
  const [protoEvent, setProtoEvent] = useState<string | null>(null);

  return (
    <div style={{ padding: 24 }}>
      {protoEvent && <ProtocolViewer eventId={protoEvent} onClose={() => setProtoEvent(null)} />}
      <h2 style={{ margin: '0 0 12px' }}>{t('nav_protocol')}</h2>
      <Card>
        {isLoading ? (
          <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>
        ) : !events?.length ? (
          <p style={{ color: 'var(--muted)' }}>{t('ev_empty')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11 }}>
                  <th style={th}>{t('ev_plate_number')}</th>
                  <th style={th}>{t('ev_vol_final')}</th>
                  <th style={th}>{t('q_status')}</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ ...td, fontFamily: 'var(--mono)' }}>
                      {e.plate_region} {e.plate_number}
                    </td>
                    <td style={{ ...td, fontFamily: 'var(--mono)' }}>{e.volume_final} m³</td>
                    <td style={td}>
                      <StatusPill status={e.status} />
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => setProtoEvent(e.id)}
                        style={{
                          border: '1px solid var(--line)',
                          background: '#fff',
                          borderRadius: 8,
                          padding: '6px 12px',
                          cursor: 'pointer',
                          color: 'var(--brand)',
                          fontWeight: 700,
                        }}
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

const th: React.CSSProperties = { padding: '6px 10px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '9px 10px' };
