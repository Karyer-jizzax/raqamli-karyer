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
import {
  CameraOffIcon,
  ChevronDownIcon,
  Maximize2Icon,
  RadioIcon,
  VideoOffIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, TableSkeleton } from '../data-table';
import { FilterSelect, FilterText } from '../filters';
import { cn } from '../lib/utils';
import { Chip, TONE_DOT } from '../status';
import { Button, buttonVariants } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/** Kadr yangilash oralig'i — doc §4.1: snapshot profilida har 2-3 soniya. */
const SNAPSHOT_INTERVAL_MS = 3000;

// ── snapshot rejimi ─────────────────────────────────────────────────────────
function SnapshotPlayer({ stream }: { stream: AgentStream }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let objectUrl = '';

    async function tick() {
      try {
        const blob = await fetchLiveSnapshot(stream.snapshot_url);
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        // Eski kadrni bo'shatamiz — 20 daqiqalik ko'rishda minglab blob
        // yig'ilib qolmasin.
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = next;
        setSrc(next);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
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

  return src ? (
    <img src={src} alt="" className="block size-full object-contain" />
  ) : (
    <Placeholder icon={CameraOffIcon} text={t(failed ? 'live_no_frame' : 'live_connecting')} />
  );
}

// ── oqim rejimi (WebRTC → HLS) ──────────────────────────────────────────────
/** WHEP: SDP offer'ni POST qilib, javobni o'rnatamiz (MediaMTX §5). */
async function playWhep(url: string, video: HTMLVideoElement): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();
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
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription?.sdp ?? '',
  });
  if (!resp.ok) {
    pc.close();
    throw new Error(`WHEP ${resp.status}`);
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });
  return pc;
}

function StreamPlayer({ stream, controls }: { stream: AgentStream; controls?: boolean }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'connecting' | 'playing' | 'error'>('connecting');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let pc: RTCPeerConnection | null = null;
    let cancelled = false;

    async function start() {
      if (stream.webrtc_url) {
        try {
          pc = await playWhep(stream.webrtc_url, video!);
          if (!cancelled) setState('playing');
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
        setState('playing');
        return;
      }
      setState('error');
    }

    start();
    return () => {
      cancelled = true;
      pc?.close();
      video.srcObject = null;
      video.removeAttribute('src');
    };
  }, [stream.webrtc_url, stream.hls_url]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        // Boshqaruv tugmalari faqat modalda: jadvaldagi kichik kadrda ular
        // bosishga xalaqit berardi (butun kadr — "kattalashtirish" tugmasi).
        controls={controls}
        className={cn('block size-full bg-black object-contain', state !== 'playing' && 'hidden')}
      />
      {state !== 'playing' && (
        <Placeholder
          icon={VideoOffIcon}
          text={t(state === 'error' ? 'live_error' : 'live_connecting')}
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
  onOpen,
}: {
  stream: AgentStream;
  mode: 'hls' | 'snapshot';
  paused: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="group overflow-hidden rounded-2xl border bg-card shadow-card">
      <header className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <b className="truncate text-data text-foreground">{cameraLabel(stream)}</b>
        <Chip tone="neutral">
          {t(mode === 'snapshot' ? 'live_snapshot_mode' : 'live_stream_mode')}
        </Chip>
      </header>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('live_open', { camera: cameraLabel(stream) })}
        className={cn(
          'relative block aspect-video w-full cursor-pointer bg-black',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {paused ? (
          <Placeholder icon={Maximize2Icon} text={t('live_open_here')} />
        ) : (
          <Player stream={stream} mode={mode} />
        )}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-2 right-2 grid size-7 place-items-center rounded-lg',
            'bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100',
          )}
        >
          <Maximize2Icon className="size-3.5" strokeWidth={2} />
        </span>
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

function Placeholder({ icon: Icon, text }: { icon: typeof CameraOffIcon; text: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center gap-2 text-center">
      <div className="grid gap-1.5 justify-items-center">
        <Icon className="size-6 text-white/40" strokeWidth={1.6} />
        <span className="text-2xs text-white/60">{text}</span>
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
      <Meta label={t('agent_cameras')} value={`${cameraOk}/${status.cameras.length || 0}`} />
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

/**
 * Qaysi kameralar devorda turishini belgilash.
 *
 * Yashiringanlar saqlanadi, tanlanganlar emas: agent yangi kamera qo'shsa u
 * o'z-o'zidan ko'rinadi. Teskarisi bo'lganda yangi kamera hech kim uni
 * ro'yxatdan qidirib topmaguncha yo'q bo'lib turardi.
 */
function CameraPicker({
  streams,
  hidden,
  onToggle,
  onAll,
}: {
  streams: AgentStream[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
}) {
  const { t } = useTranslation();
  const visible = streams.filter((s) => !hidden.has(s.camera_id)).length;
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-xs text-muted-foreground">{t('agent_cameras')}</span>
      <DropdownMenu>
        {/* Oddiy <button>, `Button` komponenti emas: `asChild` refni pastga
            uzatadi, `Button` esa uni qabul qilmaydi (forwardRef yo'q) va
            menyu umuman ochilmasdi. ProfileMenu ham shu sababdan shunday. */}
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-10 w-[190px] justify-between px-3 text-data font-normal',
            )}
          >
            <span className="tabular-nums">
              {visible === streams.length
                ? t('flt_all')
                : t('live_cams_picked', { n: visible, total: streams.length })}
            </span>
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[320px] w-[240px]">
          <DropdownMenuCheckboxItem
            checked={visible === streams.length}
            // Radix menyusi tanlovdan keyin yopiladi — bu yerda esa ketma-ket
            // bir nechta kamera belgilanadi, shuning uchun yopilishni to'xtatamiz.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={onAll}
            className="text-data"
          >
            {t('flt_all')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {streams.map((s) => (
            <DropdownMenuCheckboxItem
              key={s.camera_id}
              checked={!hidden.has(s.camera_id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onToggle(s.camera_id)}
              className="text-data"
            >
              <span className="min-w-0 truncate">
                {cameraLabel(s)}
                {s.post_name && (
                  <span className="ml-1.5 text-2xs text-muted-foreground">{s.post_name}</span>
                )}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Karyerning barcha kameralari — agent aytgan rejimda.
 *
 * Kartalar post bo'yicha guruhlanadi: kamera nomi ("Kirish 1") faqat o'z
 * posti bilan birga ma'noli, va o'nlab karta bir tekis to'r bo'lib yotsa
 * qaysi biri qayerdaligi bilinmaydi. Tartib serverdan keladi (post kodi →
 * kamera yoshi), shuning uchun kartalar joyini o'zgartirmaydi. */
export function LiveGrid({ status }: { status: AgentStatus }) {
  const { t } = useTranslation();
  // Kattalashtirilgan kamera. Kamera identifikatorini saqlaymiz, obyektni
  // emas: holat 30 soniyada yangilanadi va eski obyekt "muzlab" qolardi.
  const [openCamera, setOpenCamera] = useState<string | null>(null);
  const [post, setPost] = useState('');
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [cols, setCols] = useGridCols();

  const streams = status.streams;
  const postOptions = useMemo(
    () => [...new Set(streams.map((s) => s.post_name).filter(Boolean))],
    [streams],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return streams.filter(
      (s) =>
        !hidden.has(s.camera_id) &&
        (!post || s.post_name === post) &&
        (!q || cameraLabel(s).toLowerCase().includes(q)),
    );
  }, [streams, hidden, post, query]);

  const toggleCamera = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // "Barchasi" ikki tomonlama: hammasi yoqilgan bo'lsa hammasini o'chiradi,
  // aks holda hammasini qaytaradi.
  const toggleAll = () =>
    setHidden((prev) => (prev.size === 0 ? new Set(streams.map((s) => s.camera_id)) : new Set()));

  const clearFilters = () => {
    setPost('');
    setQuery('');
    setHidden(new Set());
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
      </div>
    );
  }

  const mode = status.live_mode === 'snapshot' ? 'snapshot' : 'hls';
  // Bitta post bo'lsa sarlavha hech nimani ajratmaydi — u shunchaki har bir
  // karyerda takrorlanadigan qator bo'lib qolardi.
  const showHeadings = groups.length > 1;

  return (
    <>
      {/* Bitta kamerali karyerda tanlaydigan narsa yo'q — na qaysi biri, na
          nechta ustunda. Qolgan hamma holatda qator turadi va har bir
          boshqaruv o'zi kerak bo'lgandagina qo'shiladi. */}
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
          <CameraPicker
            streams={streams}
            hidden={hidden}
            onToggle={toggleCamera}
            onAll={toggleAll}
          />
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
export function LivePanel({ quarryId }: { quarryId: string | undefined }) {
  const { t } = useTranslation();
  const { data: agent, isLoading } = useQuarryAgent(quarryId);

  if (!quarryId) return <EmptyState title={t('live_pick_quarry')} />;
  // `agent` saqlanib turadi (placeholderData) — karyer almashganda ekran
  // bo'shab ketmasin, faqat birinchi yuklashda skeleton ko'rsatiladi.
  if (isLoading && !agent) return <TableSkeleton rows={2} cols={2} />;
  if (!agent || !agent.is_active) {
    return <EmptyState title={t('agent_none')} hint={t('agent_none_hint')} />;
  }

  return (
    <>
      <AgentStatusStrip status={agent} />
      <LiveGrid status={agent} />
    </>
  );
}
