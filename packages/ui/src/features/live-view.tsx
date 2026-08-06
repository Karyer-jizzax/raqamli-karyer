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
import { type AgentStatus, type AgentStream, fetchLiveSnapshot } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { CameraOffIcon, RadioIcon, VideoOffIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/utils';
import { Chip, TONE_DOT } from '../status';

/** Kadr yangilash oralig'i — doc §4.1: snapshot profilida har 2-3 soniya. */
const SNAPSHOT_INTERVAL_MS = 3000;

// ── snapshot rejimi ─────────────────────────────────────────────────────────
function SnapshotCamera({ stream }: { stream: AgentStream }) {
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

  return (
    <Frame camera={stream.camera_id} badge={t('live_snapshot_mode')}>
      {src ? (
        <img src={src} alt="" className="block size-full object-contain" />
      ) : (
        <Placeholder icon={CameraOffIcon} text={t(failed ? 'live_no_frame' : 'live_connecting')} />
      )}
    </Frame>
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

function StreamCamera({ stream }: { stream: AgentStream }) {
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
    <Frame camera={stream.camera_id} badge={t('live_stream_mode')}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn('block size-full bg-black object-contain', state !== 'playing' && 'hidden')}
      />
      {state !== 'playing' && (
        <Placeholder
          icon={VideoOffIcon}
          text={t(state === 'error' ? 'live_error' : 'live_connecting')}
        />
      )}
    </Frame>
  );
}

// ── umumiy qismlar ──────────────────────────────────────────────────────────
function Frame({
  camera,
  badge,
  children,
}: {
  camera: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <header className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <b className="truncate text-data text-foreground">{camera}</b>
        <Chip tone="neutral">{badge}</Chip>
      </header>
      <div className="relative aspect-video bg-black">{children}</div>
    </article>
  );
}

function Placeholder({
  icon: Icon,
  text,
}: {
  icon: typeof CameraOffIcon;
  text: string;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center gap-2 text-center">
      <div className="grid gap-1.5 justify-items-center">
        <Icon className="size-6 text-white/40" strokeWidth={1.6} />
        <span className="text-2xs text-white/60">{text}</span>
      </div>
    </div>
  );
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
      <Meta
        label={t('agent_cameras')}
        value={`${cameraOk}/${status.cameras.length || 0}`}
      />
      <Meta label={t('agent_queue')} value={String(status.queue_size)} />
      {status.upload_kbps_avg > 0 && (
        <Meta label={t('agent_upload')} value={`${status.upload_kbps_avg} kbps`} />
      )}
      {status.current_quality && (
        <Meta label={t('agent_quality')} value={status.current_quality} />
      )}
      {status.agent_version && (
        <Meta label={t('agent_version')} value={status.agent_version} />
      )}
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

/** Karyerning barcha kameralari — agent aytgan rejimda. */
export function LiveGrid({ status }: { status: AgentStatus }) {
  const { t } = useTranslation();

  if (status.live_mode === 'off' || status.streams.length === 0) {
    return (
      <div className="grid place-items-center gap-1.5 rounded-2xl border border-dashed bg-card px-4 py-14 text-center">
        <RadioIcon className="size-6 text-muted-foreground" strokeWidth={1.6} />
        <b className="text-data text-foreground">{t('live_off')}</b>
        <span className="text-2xs text-muted-foreground">
          {t(!status.is_active ? 'live_off_no_agent' : !status.online ? 'live_off_offline' : 'live_off_disabled')}
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      {status.streams.map((s) =>
        status.live_mode === 'snapshot' ? (
          <SnapshotCamera key={s.camera_id} stream={s} />
        ) : (
          <StreamCamera key={s.camera_id} stream={s} />
        ),
      )}
    </div>
  );
}
