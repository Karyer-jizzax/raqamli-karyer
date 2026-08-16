/**
 * Yuk xati — the cargo receipt for one trip, printed like a kassa cheki.
 *
 * Three entry points over one slip:
 *  - `WaybillSheet`   the receipt itself (also what print sees),
 *  - `WaybillViewer`  the overlay opened from the qatnovlar grid,
 *  - `PublicWaybill`  the parolsiz page a scanned QR lands on.
 *
 * It carries only what a scale slip has to say: when the truck came in and
 * what it weighed, when it left and what it weighed, and the cargo that
 * leaves — in tonnes and in m³. Nothing about the model, owner or material.
 *
 * The slip paints its own colors instead of theme tokens: it is white paper
 * in both themes and on the printer, so a `text-muted-foreground` here would
 * come out invisible in dark mode.
 */
import { type WaybillDocument, usePublicWaybill, useTripWaybill } from '@karier/api-client';
import { currentLang, formatDecimal, useTranslation } from '@karier/i18n';
import type { ReactNode } from 'react';

import { splitDateTime } from './features/util';
import { Button } from './ui/button';

const INK = '#15273c';
const MUTED = '#64748b';

/** 'DD.MM.YYYY HH:MM:SS', or a dash when that crossing never happened. */
function moment(iso: string | null): string {
  const dt = splitDateTime(iso);
  return dt ? `${dt.date} ${dt.time}` : '—';
}

function tons(kg: number | null | undefined): string {
  return kg == null ? '—' : `${formatDecimal(kg / 1000, currentLang())} t`;
}

/** One receipt line: label left, value pinned right. */
function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="kk-line" style={strong ? { fontWeight: 800, fontSize: 13 } : undefined}>
      <span style={strong ? undefined : { color: MUTED }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** One weighbridge crossing: heading, then the moment and the reading. */
function Crossing({ label, at, kg }: { label: string; at: string | null; kg: number | null }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div className="kk-line">
        <span>{moment(at)}</span>
        <span style={{ fontWeight: 700 }}>{tons(kg)}</span>
      </div>
    </div>
  );
}

export function WaybillSheet({ doc }: { doc: WaybillDocument }) {
  const { t } = useTranslation();
  const where = [doc.region_name_uz_latn, doc.district_name_uz_latn, doc.quarry_name]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="kk-receipt">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '.05em' }}>
          {doc.organization_name.toUpperCase()}
        </div>
        <div style={{ color: MUTED, fontSize: 11 }}>{where}</div>
      </div>

      <hr />

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, letterSpacing: '.18em' }}>{t('wb_title')}</div>
        <div style={{ fontSize: 11 }}>№ {doc.number}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{moment(doc.issued_at)}</div>
      </div>

      <hr />

      <Line label={t('th_plate')} value={`${doc.plate_region} ${doc.plate_number}`} />
      <Line label={t('trip_kind')} value={t(`trip_kind_${doc.kind}`)} />
      <Line label={t('th_status')} value={t(`stage_${doc.stage}`)} />

      <hr />

      <Crossing label={t('th_main_enter')} at={doc.enter.at} kg={doc.enter.weight_kg} />
      <Crossing label={t('th_main_exit')} at={doc.exit.at} kg={doc.exit.weight_kg} />

      <hr />

      {/* The bottom line of the slip: the cargo itself, both ways of counting it. */}
      <Line label={t('wb_netto')} value={tons(doc.netto_kg)} strong />
      <Line
        label={t('wb_volume')}
        value={
          doc.volume_m3 == null
            ? '—'
            : `${formatDecimal(doc.volume_m3, currentLang())} ${t('vol_unit')}`
        }
        strong
      />

      <hr />

      <div style={{ textAlign: 'center' }}>
        <div
          className="kk-qr"
          style={{ width: 108, height: 108, margin: '0 auto' }}
          // Backend-generated SVG (qrcode lib), never user input.
          dangerouslySetInnerHTML={{ __html: doc.qr_svg }}
        />
        <div style={{ fontWeight: 700, marginTop: 4, color: INK }}>{doc.verification_code}</div>
        <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.4, marginTop: 2 }}>
          {t('wb_qr_hint')}
        </div>
      </div>
    </div>
  );
}

/** Shared loading / error / receipt switch, so both entry points behave alike. */
function WaybillBody({
  doc,
  isLoading,
  isError,
}: {
  doc: WaybillDocument | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const { t } = useTranslation();
  // Rendered as a slip, not bare text: it sits on a dark overlay in one entry
  // point and on a light page in the other.
  if (isLoading) {
    return (
      <div className="kk-receipt" style={{ textAlign: 'center', color: MUTED }}>
        {t('loading')}
      </div>
    );
  }
  if (isError || !doc) {
    return (
      <div className="kk-receipt" style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, color: INK }}>{t('wb_not_found')}</div>
        <div style={{ color: MUTED, marginTop: 4 }}>{t('wb_not_found_hint')}</div>
      </div>
    );
  }
  return <WaybillSheet doc={doc} />;
}

/** Full-screen receipt for a trip, opened from the qatnovlar grid. */
export function WaybillViewer({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useTripWaybill(tripId);

  return (
    <div
      className="kk-print-host"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(8,20,36,.55)',
        overflowY: 'auto',
        padding: '24px 0',
      }}
    >
      <div style={{ maxWidth: '110mm', margin: '0 auto', padding: '0 16px' }}>
        <div
          className="no-print"
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}
        >
          {/* Solid, not ghost: it sits on a dark backdrop, not on the page. */}
          <Button variant="secondary" onClick={onClose}>
            ← {t('wb_back')}
          </Button>
          {data && <Button onClick={() => window.print()}>{t('wb_print')}</Button>}
        </div>
        <WaybillBody doc={data} isLoading={isLoading} isError={isError} />
      </div>
    </div>
  );
}

/**
 * Parolsiz yuk xati — the page a scanned QR opens. No shell, no login, and
 * only the cargo data: no media, no operator names, nothing to navigate to.
 */
export function PublicWaybill({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePublicWaybill(tripId);

  return (
    <div className="kk-print-host min-h-screen bg-slate-100 py-6">
      <div style={{ maxWidth: '110mm', margin: '0 auto', padding: '0 16px' }}>
        {data && (
          <div
            className="no-print"
            style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}
          >
            <Button onClick={() => window.print()}>{t('wb_print')}</Button>
          </div>
        )}
        <WaybillBody doc={data} isLoading={isLoading} isError={isError} />
        <p className="no-print mt-3 text-center text-xs text-slate-500">{t('wb_public_note')}</p>
      </div>
    </div>
  );
}
