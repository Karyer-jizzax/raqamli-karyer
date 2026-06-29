import { type ProtocolDocument as Doc, createProtocol } from '@karier/api-client';
import { useEffect, useState } from 'react';

import { Button } from './components';

const STATUS_LABEL: Record<string, string> = {
  confirm: 'TASDIQ',
  flagged: 'BELGILANDI',
  inspect: 'TEKSHIRUVGA',
};
const STATUS_COLOR: Record<string, string> = {
  confirm: 'var(--green)',
  flagged: 'var(--amber)',
  inspect: 'var(--red)',
};

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 70px', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--muted-ink)' }}>{label}</span>
      <div style={{ background: 'var(--soft)', borderRadius: 6, height: 16 }}>
        <div style={{ width: `${w}%`, background: color, height: '100%', borderRadius: 6 }} />
      </div>
      <b style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right' }}>{value} m³</b>
    </div>
  );
}

/** Full-screen overlay that generates (idempotent) + shows a protocol for an event. */
export function ProtocolViewer({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    createProtocol(eventId)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setErr('Bayonnoma yuklanmadi'));
    return () => {
      alive = false;
    };
  }, [eventId]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(8,20,36,.55)',
        overflowY: 'auto',
        padding: '24px 0',
      }}
    >
      <div style={{ maxWidth: '230mm', margin: '0 auto', padding: '0 16px' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Button variant="ghost" onClick={onClose}>
            ← Orqaga
          </Button>
        </div>
        {err && <div style={{ color: '#fff' }}>{err}</div>}
        {doc ? <ProtocolDocument doc={doc} /> : !err && <div style={{ color: '#fff' }}>Yuklanmoqda…</div>}
      </div>
    </div>
  );
}

export function ProtocolDocument({ doc }: { doc: Doc }) {
  const { protocol: p, event: e } = doc;
  const vc = e.volume_camera ?? 0;
  const vw = e.volume_scale;
  const max = Math.max(vc, vw, e.volume_final, 1);
  const issued = new Date(p.issued_at).toLocaleString();

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button onClick={() => window.print()}>🖨 Chop etish</Button>
      </div>

      <div className="kk-protocol">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '2px solid var(--brand)', paddingBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, color: 'var(--brand)' }}>{doc.organization}</h1>
            <div style={{ fontSize: 12, color: 'var(--muted-ink)' }}>
              {doc.region_name_uz_latn} · {doc.district_name_uz_latn} · {doc.quarry_name}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800 }}>O'LCHOV BAYONNOMASI</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>№ {p.number}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-ink)' }}>{issued}</div>
          </div>
        </div>

        {/* Status banner */}
        <div
          style={{
            margin: '12px 0',
            padding: '8px 14px',
            borderRadius: 8,
            background: 'var(--soft)',
            borderLeft: `5px solid ${STATUS_COLOR[e.status]}`,
            fontWeight: 800,
            color: STATUS_COLOR[e.status],
          }}
        >
          HOLAT: {STATUS_LABEL[e.status] ?? e.status}
        </div>

        {/* Vehicle info */}
        <h3 style={{ fontSize: 13, margin: '14px 0 6px' }}>Avtotransport ma'lumotlari</h3>
        <table>
          <tbody>
            <tr>
              <th style={{ width: '25%' }}>Davlat raqami</th>
              <td style={{ fontFamily: 'var(--mono)' }}>{e.plate_region} {e.plate_number}</td>
              <th style={{ width: '25%' }}>Model</th>
              <td>{e.model}</td>
            </tr>
            <tr>
              <th>Yo'nalish</th>
              <td>{e.direction === 'enter' ? 'Kirish' : 'Chiqish'}</td>
              <th>To'lovchi</th>
              <td>{e.payer_type}</td>
            </tr>
            <tr>
              <th>Egasi</th>
              <td>{e.owner_name || '—'}</td>
              <th>STIR</th>
              <td style={{ fontFamily: 'var(--mono)' }}>{e.stir || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Measurement results */}
        <h3 style={{ fontSize: 13, margin: '16px 0 6px' }}>O'lchov natijalari</h3>
        <table>
          <tbody>
            <tr>
              <th>Kamera hajmi (L×W×H)</th>
              <td style={{ fontFamily: 'var(--mono)' }}>
                {e.volume_camera ?? '—'} m³ ({e.length_m}×{e.width_m}×{e.height_m})
              </td>
            </tr>
            <tr>
              <th>Tarozi hajmi (vazn÷zichlik)</th>
              <td style={{ fontFamily: 'var(--mono)' }}>
                {e.volume_scale} m³ ({e.weight_kg} kg ÷ {e.density})
              </td>
            </tr>
            <tr>
              <th>Farq</th>
              <td style={{ fontFamily: 'var(--mono)' }}>{e.diff_pct ?? '—'}%</td>
            </tr>
            <tr>
              <th>Material</th>
              <td>{doc.material_name_uz_latn ?? '—'}</td>
            </tr>
            <tr>
              <th>Yakuniy hajm + ishonch</th>
              <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>
                {e.volume_final} m³ · {e.volume_confidence}%
              </td>
            </tr>
          </tbody>
        </table>

        {/* Comparison chart */}
        <h3 style={{ fontSize: 13, margin: '16px 0 8px' }}>Hajm taqqoslash</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <Bar label="Kamera (AI)" value={vc} max={max} color="var(--brand2)" />
          <Bar label="Tarozi" value={vw} max={max} color="var(--teal, #0e6b6b)" />
          <Bar label="Yakuniy" value={e.volume_final} max={max} color="var(--green)" />
        </div>

        {/* Method + normative */}
        <p style={{ fontSize: 11.5, color: 'var(--muted-ink)', marginTop: 16, lineHeight: 1.5 }}>
          {p.normative_basis}
        </p>

        {/* Signatures + QR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: 24, gap: 20 }}>
          <div style={{ display: 'grid', gap: 18, flex: 1 }}>
            {[
              ['Tekshiruvchi inspektor', p.inspector_name],
              ['Tizim operatori', p.operator_name],
              ['Haydovchi', p.driver_name],
            ].map(([role, name]) => (
              <div key={role} style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8, alignItems: 'end' }}>
                <span style={{ fontSize: 12 }}>
                  {role}: <b>{name || '—'}</b>
                </span>
                <span style={{ borderBottom: '1px solid var(--ink)', height: 16 }} />
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 96, height: 96 }} dangerouslySetInnerHTML={{ __html: doc.qr_svg }} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted-ink)', marginTop: 4 }}>
              {p.verification_code}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
