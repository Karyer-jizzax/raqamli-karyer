/**
 * Onlayn/oflayn statistikasining umumiy qoidalari — ro'yxat, jurnal va kunlik
 * jadval bir xil hisoblashi uchun bitta joyda.
 *
 * Ekranda faqat ikki holat bor: **onlayn** va **oflayn**. Agent to'rt toifa
 * yuboradi (karyer-local API.md §9), lekin:
 *   - "server javob bermadi" (`server_down_min`) — o'sha paytda karyerda
 *     internet bor edi, muammo bizning serverda. Karyer statistikasini bu
 *     buzmasligi kerak, shuning uchun u **onlayn** hisoblanadi;
 *   - "internet yo'q" va "kompyuter o'chiq" — ikkalasi ham **oflayn**. Farqi
 *     texnik xodimga kerak (modemmi yoki tokmi), shuning uchun u faqat
 *     kichik kulrang izoh sifatida beriladi.
 */
import { useTranslation } from '@karier/i18n';

export interface UptimeMinutes {
  covered_min: number;
  online_min: number;
  net_down_min: number;
  server_down_min: number;
  agent_off_min: number;
  /** Hozirgi, hali yuborilmagan uzilish — sababi aloqa qaytganda keladi. */
  pending_min?: number;
}

/** Oflayn sabablari — `outages[].reason` qiymatlari. "server" bu yerda yo'q. */
export type OfflineReason = 'internet' | 'off';

export const onlineMin = (d: UptimeMinutes) => d.online_min + d.server_down_min;
export const offlineMin = (d: UptimeMinutes) =>
  d.net_down_min + d.agent_off_min + (d.pending_min ?? 0);

/** Onlayn ulushi, 0.1% aniqlikda; hisoblangan vaqt bo'lmasa null. */
export function onlinePct(d: UptimeMinutes): number | null {
  return d.covered_min > 0 ? Math.round((onlineMin(d) / d.covered_min) * 1000) / 10 : null;
}

/** Uzilish karyer tomonidami — "server" sababli oraliqlar hisobga kirmaydi. */
export const isOfflineOutage = (o: { reason: string }) => o.reason !== 'server';

/** Oflayn sababining kulrang izohi: "internet yo'q edi" / "kompyuter o'chiq edi". */
export const REASON_NOTE: Record<OfflineReason, string> = {
  internet: 'up_reason_internet',
  off: 'up_reason_off',
};

/** Daqiqani "2 kun 3 soat" / "3 soat 5 daq" / "12 daq" ko'rinishiga. */
export function useDuration(zero = '—') {
  const { t } = useTranslation();
  return (minutes: number) => {
    if (minutes <= 0) return zero;
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    if (d) return h ? t('up_dh', { d, h }) : t('up_d', { d });
    if (!h) return t('up_m', { m });
    return m ? t('up_hm', { h, m }) : t('up_h', { h });
  };
}

/** Ikki rangli chiziq: yashil — onlayn, qizil — oflayn. */
export function OnlineBar({ d, className }: { d: UptimeMinutes; className?: string }) {
  const on = d.covered_min > 0 ? (onlineMin(d) / d.covered_min) * 100 : 0;
  const off = d.covered_min > 0 ? (offlineMin(d) / d.covered_min) * 100 : 0;
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-full bg-secondary ${className ?? ''}`}>
      {on > 0 && <span className="bg-success" style={{ width: `${on}%` }} />}
      {off > 0 && <span className="bg-danger" style={{ width: `${off}%` }} />}
    </div>
  );
}
