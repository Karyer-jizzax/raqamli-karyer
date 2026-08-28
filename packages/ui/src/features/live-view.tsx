/**
 * Jonli ko'rish — karyerdagi agent qaysi rejimda bo'lsa, o'shani chizadi
 * (doc.txt §3.5, §4.1).
 *
 * Uchta rejim bor va ular kanal tezligiga qarab agent tomonidan tanlanadi:
 *
 * * `hls`      — MediaMTX orqali jonli oqim. Avval WebRTC (WHEP) sinaladi:
 *                kechikish past va hech qanday kutubxona kerak emas —
 *                brauzerning o'z `RTCPeerConnection`i SDP almashadi. WHEP
 *                bo'lmasa yoki ochilmasa, HLS'ga tushiladi (Safari uni o'zi
 *                o'ynatadi).
 * * `snapshot` — 144 kbps kanal: video o'rniga har 3 soniyada bitta JPEG.
 *                Kadr autentifikatsiya talab qiladi, `<img src>` esa sarlavha
 *                yubora olmaydi — shuning uchun blob orqali olinadi.
 * * `off`      — agent oflayn yoki jonli ko'rinish o'chirilgan. Bu holatda
 *                abadiy "yuklanmoqda" spinner emas, sababi yozilgan karta
 *                ko'rsatiladi: operator nima kutayotganini bilsin.
 *
 * Jonli ko'rish — qo'shimcha qavat: u ishlamasa ham hodisalar oqimi (vazn,
 * foto, video) to'liq ishlayveradi.
 */
import {
  type AgentStatus,
  type AgentStream,
  fetchLiveSnapshot,
  useQuarryAgent,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { CameraOffIcon, Maximize2Icon, RadioIcon, VideoOffIcon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, TableSkeleton } from '../data-table';
import { FilterSelect, FilterText } from '../filters';
import { cn } from '../lib/utils';
import { Chip, TONE_DOT } from '../status';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

/** Kadr yangilash oralig'i — doc §4.1: snapshot profilida har 2-3 soniya. */
const SNAPSHOT_INTERVAL_MS = 3000;

/** WHEP SDP almashinuvi shuncha kutadi — MediaMTX javob bermasa uzamiz. */
const WHEP_FETCH_TIMEOUT_MS = 8000;
/** Birinchi kadrgacha umumiy chegara. `playWhep` ichidagi ICE kutuvidan (3 s)
 *  va SDP taymautidan (8 s) kattaroq bo'lishi shart. */
const CONNECT_TIMEOUT_MS = 15_000;
/** Oqim qotganini bilish oralig'i: sekin kanalda kadrlar siyrak keladi,
 *  shuning uchun o'lchov qo'pol — ikki tekshiruvda ham surilmasa xato. */
const WATCHDOG_INTERVAL_MS = 6000;
/** `disconnected` odatda o'tkinchi — shuncha kutamiz. */
const DISCONNECT_GRACE_MS = 5000;
/** Avtomatik qayta ulanish oraliqlari; tugagach tugma foydalanuvchida. */
const RETRY_DELAYS_MS = [2000, 5000, 10_000];

// ── snapshot rejimi ─────────────────────────────────────────────────────────
function SnapshotPlayer({ stream }: { stream: AgentStream }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState('');
  // "Eskirgan" — kadr kelmayapti yoki server uni eskirgan deb belgiladi.
  // Ikkalasi bir xil ko'rinadi: ekranda o'sha bitta qotib qolgan rasm.
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let objectUrl = '';

    async function tick() {
      try {
        const snap = await fetchLiveSnapshot(stream.snapshot_url);
        if (cancelled) return;
        const next = URL.createObjectURL(snap.blob);
        // Eski kadrni bo'shatamiz — 20 daqiqalik ko'rishda minglab blob
        // yig'ilib qolmasin.
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = next;
        setSrc(next);
        setStale(!snap.fresh);
      } catch {
        if (!cancelled) setStale(true);
      }
      if (!cancelled) timer = setTimeout(tick, SNAPSHOT_INTERVAL_MS);
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stream.snapshot_url]);

  // Eskirgan kadr o'chirilmaydi — qora ekrandan ko'ra "yarim soat oldingi
  // manzara" foydaliroq. Lekin uni jim ko'rsatish yaramaydi: agent uzilganda
  // muzlagan rasm jonli ko'rinib turardi, shuning uchun ustiga yozuv qo'yiladi.
  if (!src) {
    return (
      <Placeholder icon={CameraOffIcon} text={t(stale ? 'live_no_frame' : 'live_connecting')} />
    );
  }
  return (
    <>
      <img src={src} alt="" className="block size-full object-contain" />
      {stale && (
        <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center text-2xs text-white/80">
          {t('live_no_frame')}
        </span>
      )}
    </>
  );
}

// ── oqim rejimi (WebRTC → HLS) ──────────────────────────────────────────────
/** WHEP: SDP offer'ni POST qilib, javobni o'rnatamiz (MediaMTX §5). */
async function playWhep(url: string, video: HTMLVideoElement): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();
  try {
    return await negotiateWhep(pc, url, video);
  } catch (e) {
    // Har qanday yo'lda yopiladi. Ilgari faqat `!resp.ok` da yopilardi:
    // tarmoq uzilsa yoki SDP javobi buzuq bo'lsa ulanish osilib qolar, va
    // qayta urinishlar bir kameraga o'nlab ochiq PeerConnection to'plardi.
    pc.close();
    throw e;
  }
}

async function negotiateWhep(
  pc: RTCPeerConnection,
  url: string,
  video: HTMLVideoElement,
): Promise<RTCPeerConnection> {
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.ontrack = (e) => {
    video.srcObject = e.streams[0] ?? null;
  };
  await pc.setLocalDescription(await pc.createOffer());
  // ICE nomzodlari yig'ilib bo'lishini kutamiz — MediaMTX trickle'siz offer
  // kutadi, aks holda ulanish "checking"da qotib qoladi.
  if (pc.iceGatheringState !== 'complete') {
    await new Promise<void>((resolve) => {
      const done = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', done);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', done);
      // Sekin tarmoqda cheksiz kutmaslik uchun.
      setTimeout(resolve, 3000);
    });
  }
  // MediaMTX o'chib qolsa `fetch` javobsiz osilib turardi va karta abadiy
  // "Ulanmoqda…" da qolardi — brauzerning o'z taymauti bir necha daqiqa.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), WHEP_FETCH_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription?.sdp ?? '',
      signal: abort.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`WHEP ${resp.status}`);
  await pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });
  return pc;
}

function StreamPlayer({ stream, controls }: { stream: AgentStream; controls?: boolean }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'connecting' | 'playing' | 'error'>('connecting');
  // Nechanchi urinish — effekt deps'ida, ya'ni oshirilishi qayta ulanish.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let pc: RTCPeerConnection | null = null;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    setState('connecting');

    const fail = () => {
      if (!cancelled) setState('error');
    };

    // Ulanish qotib qolmasin: WHEP'ning o'z taymautlari ustiga umumiy chegara,
    // aks holda "Ulanmoqda…" cheksiz aylanaveradi va operator kamerani buzuq
    // deb o'ylaydi.
    timers.push(
      setTimeout(() => {
        if (videoRef.current && videoRef.current.readyState < 2) fail();
      }, CONNECT_TIMEOUT_MS),
    );

    // Muzlagan kadr qorovuli. `stalled` hodisasi bu yerda yaramaydi: u ~3
    // soniya ma'lumot kelmasa uchadi, bu tizim esa 144 kbps kanallar uchun
    // (doc §4.1) — yolg'on xato berardi. `currentTime` esa ketma-ket ikki
    // tekshiruvda surilmasa, oqim haqiqatan to'xtagan.
    let lastTime = -1;
    let frozen = 0;
    const watchdog = setInterval(() => {
      const v = videoRef.current;
      if (cancelled || !v || v.paused || v.readyState < 2) return;
      if (v.currentTime === lastTime) {
        frozen += 1;
        if (frozen >= 2) fail();
      } else {
        frozen = 0;
        lastTime = v.currentTime;
      }
    }, WATCHDOG_INTERVAL_MS);

    async function start() {
      if (stream.webrtc_url) {
        try {
          const conn = await playWhep(stream.webrtc_url, video!);
          // Effekt await ichida tozalangan bo'lishi mumkin — o'sha paytda
          // cleanup `pc`ni hali null ko'rgan, ya'ni bu ulanishni o'zimiz
          // yopamiz, aks holda u ochiq qolib ketardi.
          if (cancelled) {
            conn.close();
            return;
          }
          pc = conn;
          conn.onconnectionstatechange = () => {
            if (cancelled) return;
            const st = conn.connectionState;
            if (st === 'failed' || st === 'closed') fail();
            // `disconnected` ko'pincha o'tkinchi (tarmoq sakradi) — darrov
            // xato deb e'lon qilish ishlab turgan oqimni bekorga uzardi.
            else if (st === 'disconnected') timers.push(setTimeout(fail, DISCONNECT_GRACE_MS));
          };
          return;
        } catch {
          /* HLS'ga tushamiz */
        }
      }
      if (cancelled) return;
      // HLS: Safari/iOS uni o'zi o'ynatadi. Boshqa brauzerlarda MSE kerak —
      // bunday holatda WebRTC yagona yo'l, shuning uchun xato ko'rsatamiz.
      const canHls = video!.canPlayType('application/vnd.apple.mpegurl');
      if (stream.hls_url && canHls) {
        video!.src = stream.hls_url;
        return;
      }
      fail();
    }

    start();
    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
      clearInterval(watchdog);
      if (pc) {
        pc.onconnectionstatechange = null;
        pc.close();
      }
      video.srcObject = null;
      video.removeAttribute('src');
    };
  }, [stream.webrtc_url, stream.hls_url, attempt]);

  const retryable = attempt + 1 < RETRY_DELAYS_MS.length;

  // Chegaralangan avtomatik qayta ulanish: MediaMTX qayta ko'tarilganda
  // devordagi o'nlab karta o'zi tiklanadi. Cheksiz emas — o'chirilgan kamera
  // brauzerni bekorga qiynamasin, qolgani foydalanuvchi ixtiyorida.
  useEffect(() => {
    if (state !== 'error' || !retryable) return;
    const timer = setTimeout(() => setAttempt((n) => n + 1), RETRY_DELAYS_MS[attempt]);
    return () => clearTimeout(timer);
  }, [state, attempt, retryable]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        // Holat haqiqiy ijrodan olinadi, ulanish muvaffaqiyatidan emas: ilgari
        // `playing` SDP almashinuvidan keyin darrov qo'yilardi va bir kadr ham
        // kelmagan oqim "ishlayapti" bo'lib turaverardi.
        onPlaying={() => setState('playing')}
        onLoadedData={() => setState('playing')}
        onError={() => setState('error')}
        onEnded={() => setState('error')}
        // Boshqaruv tugmalari faqat modalda: jadvaldagi kichik kadrda ular
        // bosishga xalaqit berardi (butun kadr — "kattalashtirish" tugmasi).
        controls={controls}
        className={cn('block size-full bg-black object-contain', state !== 'playing' && 'hidden')}
      />
      {state !== 'playing' && (
        <Placeholder
          icon={VideoOffIcon}
          text={t(
            state === 'error' && !retryable
              ? 'live_error'
              : attempt > 0 || state === 'error'
                ? 'live_retrying'
                : 'live_connecting',
          )}
          action={
            state === 'error' && !retryable ? (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  // Karta butunligicha "kattalashtirish" tugmasi — bosish
                  // modalni ochib yubormasin.
                  e.stopPropagation();
                  setAttempt(0);
                }}
              >
                {t('live_retry')}
              </Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

/** Rejimga mos pleer — jadvalda ham, modalda ham shu ishlatiladi. */
function Player({
  stream,
  mode,
  controls,
}: {
  stream: AgentStream;
  mode: 'hls' | 'snapshot';
  controls?: boolean;
}) {
  return mode === 'snapshot' ? (
    <SnapshotPlayer stream={stream} />
  ) : (
    <StreamPlayer stream={stream} controls={controls} />
  );
}

// ── jadvaldagi katak ────────────────────────────────────────────────────────
/** Ekranda ko'rinadigan kamera nomi — adminkada berilgani.
 *
 * `camera_id` — texnik identifikator (MediaMTX yo'li shundan yasaladi) va u
 * ko'pincha "DAHUASBJN" ko'rinishidagi kod bo'ladi: operatorga hech narsa
 * demaydi. Nom topilmagan holat uchun kod zaxira bo'lib qoladi — kamera
 * kartasi nomsiz turgandan ko'ra kodi bilan tursin. */
const cameraLabel = (stream: AgentStream) => stream.camera_name || stream.camera_id;

/** Bitta kamera kartasi. Kadr bosilsa — modalda kattalashadi.
 *
 * `paused` — shu kamera modalda ochilgan: kadr modal ostida ko'rinmaydi,
 * shuning uchun pleerni umuman ulamaymiz. Aks holda bitta kameraga ikkita
 * ulanish ketardi (karyerning kanalidan emas, lekin brauzerdan bekorga). */
function CameraTile({
  stream,
  mode,
  paused,
  ok,
  onOpen,
}: {
  stream: AgentStream;
  mode: 'hls' | 'snapshot';
  paused: boolean;
  ok: boolean | undefined;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  // `undefined` — agent kameralar haqida hech nima aytmagan (ro'yxat bazadan
  // yig'ilgan). Uni "buzuq"ga qo'shib yuborish ishlayotgan kamerani qizil
  // qilib qo'yardi, shuning uchun faqat aniq `false` hisobga olinadi.
  const down = ok === false;
  return (
    <article className="group overflow-hidden rounded-2xl border bg-card shadow-card">
      <header className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <b className="truncate text-data text-foreground">{cameraLabel(stream)}</b>
        <Chip tone={down ? 'danger' : 'neutral'}>
          {t(
            down ? 'live_cam_down' : mode === 'snapshot' ? 'live_snapshot_mode' : 'live_stream_mode',
          )}
        </Chip>
      </header>
      <button
        type="button"
        onClick={onOpen}
        disabled={down}
        aria-label={t('live_open', { camera: cameraLabel(stream) })}
        className={cn(
          'relative block aspect-video w-full bg-black',
          down
            ? 'cursor-default'
            : 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {/* Buzuq kameraga umuman ulanmaymiz: pleer baribir qora ekran va
            "Oqimni ochib bo'lmadi" berardi — sababi esa allaqachon ma'lum. */}
        {down ? (
          <Placeholder icon={CameraOffIcon} text={t('live_cam_down_hint')} />
        ) : paused ? (
          <Placeholder icon={Maximize2Icon} text={t('live_open_here')} />
        ) : (
          <Player stream={stream} mode={mode} />
        )}
        {!down && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-2 right-2 grid size-7 place-items-center rounded-lg',
              'bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100',
            )}
          >
            <Maximize2Icon className="size-3.5" strokeWidth={2} />
          </span>
        )}
      </button>
    </article>
  );
}

/** Tanlangan kamera — kattaroq kadr va pleer boshqaruvi bilan. */
function CameraDialog({
  stream,
  mode,
  onClose,
}: {
  stream: AgentStream;
  mode: 'hls' | 'snapshot';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="gap-0 overflow-hidden p-0 sm:max-w-[900px]"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-4 py-3 pr-12">
          <DialogTitle className="text-sm font-semibold">{cameraLabel(stream)}</DialogTitle>
          <Chip tone="neutral">
            {t(mode === 'snapshot' ? 'live_snapshot_mode' : 'live_stream_mode')}
          </Chip>
        </DialogHeader>
        <div className="relative aspect-video w-full bg-black">
          <Player stream={stream} mode={mode} controls />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Placeholder({
  icon: Icon,
  text,
  action,
}: {
  icon: typeof CameraOffIcon;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center gap-2 text-center">
      <div className="grid gap-1.5 justify-items-center">
        <Icon className="size-6 text-white/40" strokeWidth={1.6} />
        <span className="text-2xs text-white/60">{text}</span>
        {action}
      </div>
    </div>
  );
}

/** Agent o'zi tanlagan profil nomi — "low" emas, "Past".
 *
 * `current_quality` agentdan kelgan erkin satr, shuning uchun faqat biladigan
 * qiymatlarimizni tarjima qilamiz: notanishi o'z holicha ko'rinsin, i18next
 * kalitning o'zini qaytarib "agent_qs_xyz" deb yozib qo'ymasin. */
const QUALITY_KEYS = ['auto', 'snapshot', 'low', 'medium', 'high'];

function qualityLabel(quality: string, t: (k: string) => string): string {
  const q = quality.trim().toLowerCase();
  return QUALITY_KEYS.includes(q) ? t(`agent_qs_${q}`) : quality;
}

/** Agent holati: online, tarozi, kameralar, navbat, kanal (doc §3.3).
 *
 * `flat` — boshqa kartaning ichida turganda (karyer sahifasi): ikkilangan
 * soya va burchak bo'lmasin. */
export function AgentStatusStrip({ status, flat }: { status: AgentStatus; flat?: boolean }) {
  const { t } = useTranslation();
  // Maxraj — ekranda nechta karta chizilsa, o'sha. Ilgari heartbeat ro'yxati
  // sanalardi va agent hech nima aytmagan karyerda chiziq "0/0" deb turar,
  // tagida esa bazadan kelgan beshta kamera ko'rinardi.
  const total = status.streams.length;
  // Agent aytmagan bo'lsa "nechtasi sog'" degani noma'lum — nol emas.
  const reported = status.cameras.length > 0;
  const cameraOk = status.cameras.filter((c) => c.ok).length;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-3',
        flat ? 'rounded-lg bg-surface-subtle' : 'rounded-2xl bg-card shadow-card',
      )}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            'inline-block size-[9px] rounded-full',
            TONE_DOT[status.online ? 'success' : 'danger'],
          )}
        />
        <b className="text-data text-foreground">
          {t(status.online ? 'agent_online' : 'agent_offline')}
        </b>
      </span>
      <Meta label={t('agent_scale')} value={t(status.scale_ok ? 'agent_ok' : 'agent_fail')} />
      <Meta label={t('agent_cameras')} value={reported ? `${cameraOk}/${total}` : `${total}`} />
      <Meta label={t('agent_queue')} value={String(status.queue_size)} />
      {status.upload_kbps_avg > 0 && (
        <Meta label={t('agent_upload')} value={`${status.upload_kbps_avg} kbps`} />
      )}
      {status.current_quality && (
        <Meta label={t('agent_quality')} value={qualityLabel(status.current_quality, t)} />
      )}
      {/* Agent versiyasi bu yerda emas: bu chiziq "hozir ishlayaptimi" degan
          savolga javob beradi, versiya esa adminkaning agent kartasida —
          uni operator ham, inspektor ham hech qachon ishlatmaydi. */}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-2xs text-muted-foreground">
      {label}: <b className="text-data text-foreground tabular-nums">{value}</b>
    </span>
  );
}

/** Kameralar soni shundan oshsa filtr qatori chiqadi.
 *
 * Ikki kamerali karyerda post tanlagich va qidiruv maydoni ish bermaydi — ular
 * ekranda joy egallaydi va tanlaydigan narsasi yo'q. Devor kattalashganda esa
 * (bir karyerda o'nlab kamera bo'lishi mumkin) qidiruvsiz kerakli kamerani
 * ko'z bilan izlashga to'g'ri keladi. */
const FILTER_FROM = 4;

/**
 * Ustunlar soni — sinflar to'liq yozilgan, chunki Tailwind manbani matn
 * sifatida o'qiydi va `grid-cols-${n}` degan qatorni hech qachon topmaydi.
 *
 * Kichik ekranda hamma variant bitta ustun: 16:9 kadrni telefonda ikkiga
 * bo'lish uni ko'rib bo'lmaydigan qilib qo'yadi.
 */
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
};
const COL_CHOICES = [1, 2, 3, 4];
const COLS_KEY = 'kk_live_cols';

/** Ustunlar soni — ko'rish odati, sessiyaniki emas: bir marta tanlangan
 *  ko'rinish keyingi kirishda ham o'shaligicha ochilsin. */
function useGridCols() {
  const [cols, setCols] = useState(() => {
    try {
      const v = Number(localStorage.getItem(COLS_KEY));
      return COL_CHOICES.includes(v) ? v : 3;
    } catch {
      return 3;
    }
  });
  return [
    cols,
    (v: number) => {
      setCols(v);
      try {
        localStorage.setItem(COLS_KEY, String(v));
      } catch {
        /* ignore */
      }
    },
  ] as const;
}

/** Devordagi ustunlar sonini tanlash. */
function ColumnPicker({ cols, onChange }: { cols: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-xs text-muted-foreground">{t('live_cols')}</span>
      <div
        // h-10: qatordagi Select va Input ham shuncha — aks holda tagi
        // tekislanib, yorlig'i boshqalardan pastda turardi.
        className="flex h-10 items-center gap-0.5 rounded-md border bg-background p-0.5"
        role="group"
        aria-label={t('live_cols')}
      >
        {COL_CHOICES.map((n) => (
          <Button
            key={n}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={n === cols}
            aria-label={t('live_cols_n', { n })}
            title={t('live_cols_n', { n })}
            onClick={() => onChange(n)}
            className={cn(
              'h-9 w-9 rounded-[5px] text-data font-semibold tabular-nums',
              n === cols
                ? 'bg-primary-tint text-primary hover:bg-primary-tint hover:text-primary'
                : 'text-muted-foreground',
            )}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Karyerning barcha kameralari — agent aytgan rejimda.
 *
 * Kartalar post bo'yicha guruhlanadi: kamera nomi ("Kirish 1") faqat o'z
 * posti bilan birga ma'noli, va o'nlab karta bir tekis to'r bo'lib yotsa
 * qaysi biri qayerdaligi bilinmaydi. Tartib serverdan keladi (post kodi →
 * kamera yoshi), shuning uchun kartalar joyini o'zgartirmaydi. */
export function LiveGrid({ status, offHint }: { status: AgentStatus; offHint?: ReactNode }) {
  const { t } = useTranslation();
  // Kattalashtirilgan kamera. Kamera identifikatorini saqlaymiz, obyektni
  // emas: holat 30 soniyada yangilanadi va eski obyekt "muzlab" qolardi.
  const [openCamera, setOpenCamera] = useState<string | null>(null);
  const [post, setPost] = useState('');
  const [query, setQuery] = useState('');
  const [cols, setCols] = useGridCols();

  const streams = status.streams;
  // Agent heartbeat'da har bir kamera holatini aytadi. Ro'yxat bazadan
  // yig'ilgan bo'lsa bu xarita bo'sh bo'ladi va hamma kamera "noma'lum"
  // qoladi — bu to'g'ri: bilmaganni buzuq deb ko'rsatib bo'lmaydi.
  const health = useMemo(
    () => new Map(status.cameras.map((c) => [c.id, c.ok])),
    [status.cameras],
  );
  const postOptions = useMemo(
    () => [...new Set(streams.map((s) => s.post_name).filter(Boolean))],
    [streams],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return streams.filter(
      (s) => (!post || s.post_name === post) && (!q || cameraLabel(s).toLowerCase().includes(q)),
    );
  }, [streams, post, query]);

  const clearFilters = () => {
    setPost('');
    setQuery('');
  };

  // Guruhlar ham tartibni serverdan oladi: Map kalitlarni kiritilgan tartibda
  // saqlaydi, ya'ni birinchi uchragan post birinchi bo'lim bo'ladi.
  const groups = useMemo(() => {
    const byPost = new Map<string, AgentStream[]>();
    for (const s of shown) {
      const key = s.post_name || '';
      const group = byPost.get(key);
      if (group) group.push(s);
      else byPost.set(key, [s]);
    }
    return [...byPost.entries()];
  }, [shown]);

  // Modal `streams` bo'yicha qidiriladi, `shown` bo'yicha emas: kamerani ochib
  // turib filtr yozgan odam uni yopishni so'ramagan.
  const opened = streams.find((s) => s.camera_id === openCamera) ?? null;

  if (status.live_mode === 'off' || streams.length === 0) {
    return (
      <div className="grid place-items-center gap-1.5 rounded-2xl border border-dashed bg-card px-4 py-14 text-center">
        <RadioIcon className="size-6 text-muted-foreground" strokeWidth={1.6} />
        <b className="text-data text-foreground">{t('live_off')}</b>
        <span className="text-2xs text-muted-foreground">
          {t(
            !status.is_active
              ? 'live_off_no_agent'
              : !status.online
                ? 'live_off_offline'
                : 'live_off_disabled',
          )}
        </span>
        {/* Bu karyerda oqim yo'qligi "hech qayerda yo'q" degani emas —
            chaqiruvchi bilsa, qayerda borligini shu yerda aytadi. */}
        {offHint && <div className="mt-2.5">{offHint}</div>}
      </div>
    );
  }

  const mode = status.live_mode === 'snapshot' ? 'snapshot' : 'hls';
  // Bitta post bo'lsa sarlavha hech nimani ajratmaydi — u shunchaki har bir
  // karyerda takrorlanadigan qator bo'lib qolardi.
  const showHeadings = groups.length > 1;

  return (
    <>
      {/* Bitta kamerali karyerda tanlaydigan narsa yo'q — na posti, na nechta
          ustunda. Qolgan hamma holatda qator turadi va har bir boshqaruv o'zi
          kerak bo'lgandagina qo'shiladi. */}
      {streams.length > 1 && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card">
          {postOptions.length > 1 && (
            <div className="w-[190px]">
              <FilterSelect
                label={t('th_post')}
                value={post}
                onChange={setPost}
                options={postOptions.map((p) => [p, p])}
              />
            </div>
          )}
          {streams.length > FILTER_FROM && (
            <div className="w-[190px]">
              <FilterText
                label={t('th_camera')}
                value={query}
                onChange={setQuery}
                placeholder={t('live_search_ph')}
              />
            </div>
          )}
          <ColumnPicker cols={cols} onChange={setCols} />
          <span className="ml-auto pb-2.5 text-2xs text-muted-foreground tabular-nums">
            {shown.length} / {streams.length} · {t('agent_cameras')}
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState
          title={t('empty_no_match')}
          hint={t('empty_no_match_hint')}
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t('flt_clear')}
            </Button>
          }
        />
      ) : (
        groups.map(([postName, cams]) => (
          <section key={postName || '__none__'} className="flex flex-col gap-2.5">
            {showHeadings && (
              <h3 className="m-0 flex items-center gap-2 text-2xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {postName || t('live_post_unknown')}
                <span className="tabular-nums">({cams.length})</span>
              </h3>
            )}
            <div className={cn('grid gap-3.5', GRID_COLS[cols])}>
              {cams.map((s) => (
                <CameraTile
                  key={s.camera_id}
                  stream={s}
                  mode={mode}
                  ok={health.get(s.camera_id)}
                  paused={s.camera_id === openCamera}
                  onOpen={() => setOpenCamera(s.camera_id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
      {opened && <CameraDialog stream={opened} mode={mode} onClose={() => setOpenCamera(null)} />}
    </>
  );
}

/**
 * Bitta karyerning jonli ko'rinishi: holat chizig'i + kameralar.
 *
 * Karyer ilovasi operatorning o'z karyerini beradi, departament esa
 * ro'yxatdan tanlanganini — ekranning qolgan qismi ikkalasida bir xil.
 */
export function LivePanel({
  quarryId,
  offHint,
}: {
  quarryId: string | undefined;
  /** "Bu karyerda yo'q, lekin ana u yerda bor" — bo'sh holatlar ostida
   *  chiziladi. Karyer ilovasida bitta karyer bor, ya'ni aytadigan gap yo'q:
   *  berilmasa ekran bugungidek qoladi. */
  offHint?: ReactNode;
}) {
  const { t } = useTranslation();
  const { data: agent, isLoading, isError } = useQuarryAgent(quarryId);

  if (!quarryId) return <EmptyState title={t('live_pick_quarry')} />;
  // `agent` saqlanib turadi (placeholderData) — karyer almashganda ekran
  // bo'shab ketmasin, faqat birinchi yuklashda skeleton ko'rsatiladi.
  if (isLoading && !agent) return <TableSkeleton rows={2} cols={2} />;
  // Tarmoq xatosi "agent sozlanmagan" emas. Ilgari ikkalasi bir tarmoqqa
  // tushib, uzilgan internet karyerni sozlanmagan qilib ko'rsatardi.
  // `!agent` sharti muhim: pollingdagi bitta uzilish ishlab turgan ekranni
  // o'chirib yubormasin.
  if (isError && !agent) {
    return <EmptyState title={t('err_load')} hint={t('err_load_hint')} action={offHint} />;
  }
  if (!agent || !agent.is_active) {
    return <EmptyState title={t('agent_none')} hint={t('agent_none_hint')} action={offHint} />;
  }

  return (
    <>
      <AgentStatusStrip status={agent} />
      <LiveGrid status={agent} offHint={offHint} />
    </>
  );
}
