/**
 * Karyer agenti — adminka kartasi (doc.txt §2.2, §3.2, §3.5).
 *
 * Uch qismdan iborat va uchalasi bitta modalda turadi, chunki texnik xodim
 * karyerga borganda ham shu uchtasi kerak bo'ladi: token (o'rnatish uchun),
 * holat (ishlayaptimi), sozlama (nimani o'zgartirish kerak).
 *
 * Token faqat bir joyda ko'rinadi — bu yerda. Qayta generatsiya eski tokenni
 * o'sha zahoti o'ldiradi, shuning uchun tasdiq so'raladi.
 */
import {
  ApiError,
  type AgentConfig,
  type AgentStatus,
  type AgentVideoQuality,
  type Quarry,
  useCreateAgentToken,
  useQuarryAgent,
  useRevokeAgentToken,
  useUpdateAgentConfig,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UiButton as Button,
  cn,
} from '@karier/ui';
import { KeyRoundIcon, RefreshCwIcon, ShieldOffIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { Eyebrow } from '../shared';

const QUALITIES: AgentVideoQuality[] = ['auto', 'snapshot', 'low', 'medium', 'high'];

function timeAgo(iso: string | null, t: (k: string, p?: Record<string, unknown>) => string): string {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 90) return t('agent_ago_sec', { n: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return t('agent_ago_min', { n: minutes });
  return t('agent_ago_hour', { n: Math.round(minutes / 60) });
}

// ── holat ───────────────────────────────────────────────────────────────────
function StatusBlock({ status }: { status: AgentStatus }) {
  const { t } = useTranslation();
  const rows: [string, string][] = [
    [t('agent_last_seen'), timeAgo(status.last_seen_at, t)],
    [t('agent_scale'), t(status.scale_ok ? 'agent_ok' : 'agent_fail')],
    [
      t('agent_cameras'),
      status.cameras.length
        ? `${status.cameras.filter((c) => c.ok).length}/${status.cameras.length}`
        : '—',
    ],
    [t('agent_queue'), String(status.queue_size)],
    [t('agent_upload'), status.upload_kbps_avg ? `${status.upload_kbps_avg} kbps` : '—'],
    [t('agent_quality'), status.current_quality || '—'],
    [t('agent_version'), status.agent_version || '—'],
  ];

  return (
    <section className="grid gap-2.5 rounded-xl border bg-[#fbfcfe] p-3.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-block size-[9px] rounded-full',
            status.online ? 'bg-[#10b981]' : 'bg-[#ef4444]',
          )}
        />
        <b className="text-sm">{t(status.online ? 'agent_online' : 'agent_offline')}</b>
        {!status.is_active && (
          <span className="text-xs text-destructive">{t('agent_token_revoked')}</span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-0.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="m-0 font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── token ───────────────────────────────────────────────────────────────────
function TokenBlock({ quarry, status }: { quarry: Quarry; status: AgentStatus | undefined }) {
  const { t } = useTranslation();
  const issue = useCreateAgentToken();
  const revoke = useRevokeAgentToken();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<'regen' | 'revoke' | null>(null);
  const [err, setErr] = useState('');

  // Qayta generatsiyadan keyingi token faqat javobda keladi — GET uni
  // saqlaydi, lekin foydalanuvchi darhol nusxalashi kerak.
  const token = issue.data?.token ?? status?.token ?? '';
  const hasAgent = Boolean(status?.token_issued_at);

  async function run(action: 'regen' | 'revoke') {
    setErr('');
    setConfirming(null);
    try {
      if (action === 'regen') await issue.mutateAsync(quarry.id);
      else await revoke.mutateAsync(quarry.id);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Error');
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard yo'q — matnni qo'lda belgilash mumkin */
    }
  }

  return (
    <section className="grid gap-2.5">
      <Eyebrow className="text-slate-400">{t('agent_token_title')}</Eyebrow>
      <p className="m-0 text-xs text-muted-foreground">{t('agent_token_hint')}</p>

      {token ? (
        <textarea
          readOnly
          value={token}
          onFocus={(e) => e.target.select()}
          rows={2}
          className="w-full rounded-[10px] border bg-[#f8fafc] px-3 py-2 font-mono text-[12px] break-all"
        />
      ) : (
        <p className="m-0 text-sm text-muted-foreground">
          {t(hasAgent ? 'agent_token_hidden' : 'agent_token_absent')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {token && (
          <Button type="button" size="sm" variant="outline" onClick={copy}>
            {copied ? t('q_token_copied') : t('q_token_copy')}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={issue.isPending}
          onClick={() => (hasAgent ? setConfirming('regen') : run('regen'))}
        >
          {hasAgent ? <RefreshCwIcon /> : <KeyRoundIcon />}
          {t(hasAgent ? 'agent_token_regen' : 'agent_token_create')}
        </Button>
        {hasAgent && status?.is_active && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={revoke.isPending}
            onClick={() => setConfirming('revoke')}
          >
            <ShieldOffIcon />
            {t('agent_token_revoke')}
          </Button>
        )}
      </div>

      {confirming && (
        <div className="grid gap-2 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-3">
          <p className="m-0 text-xs">
            {t(confirming === 'regen' ? 'agent_regen_confirm' : 'agent_revoke_confirm')}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => run(confirming)}>
              {t('q_yes')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(null)}>
              {t('q_no')}
            </Button>
          </div>
        </div>
      )}

      {err && <span className="text-xs text-destructive">{err}</span>}
    </section>
  );
}

// ── sozlama ─────────────────────────────────────────────────────────────────
function ConfigBlock({ quarryId, config }: { quarryId: string; config: AgentConfig }) {
  const { t } = useTranslation();
  const update = useUpdateAgentConfig();
  const [draft, setDraft] = useState<AgentConfig>(config);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  // Agent kartasi 30 soniyada yangilanadi — foydalanuvchi tahrirlamayotgan
  // paytda serverdagi qiymat bilan sinxron qolsin.
  useEffect(() => {
    setDraft(config);
  }, [config]);

  const num =
    (key: keyof AgentConfig) =>
    (e: { target: { value: string } }) =>
      setDraft((d) => ({ ...d, [key]: Number(e.target.value) }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await update.mutateAsync({ quarryId, body: draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  const fields: [keyof AgentConfig, string, number, number][] = [
    ['event_pre_seconds', 'agent_cfg_pre', 0, 60],
    ['event_post_seconds', 'agent_cfg_post', 0, 60],
    ['min_event_weight_kg', 'agent_cfg_min_weight', 0, 100000],
    ['stable_seconds', 'agent_cfg_stable', 1, 60],
    ['heartbeat_interval_sec', 'agent_cfg_heartbeat', 10, 3600],
  ];

  return (
    <form onSubmit={onSubmit} className="grid gap-2.5">
      <Eyebrow className="text-slate-400">{t('agent_cfg_title')}</Eyebrow>
      <p className="m-0 text-xs text-muted-foreground">{t('agent_cfg_hint')}</p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t('agent_cfg_quality')}</Label>
          <Select
            value={draft.video_quality}
            onValueChange={(v) => setDraft((d) => ({ ...d, video_quality: v as AgentVideoQuality }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUALITIES.map((q) => (
                <SelectItem key={q} value={q}>
                  {t(`agent_q_${q}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {fields.map(([key, labelKey, min, max]) => (
          <div key={key} className="grid gap-1.5">
            <Label htmlFor={`cfg-${key}`}>{t(labelKey)}</Label>
            <Input
              id={`cfg-${key}`}
              type="number"
              min={min}
              max={max}
              value={String(draft[key] ?? '')}
              onChange={num(key)}
            />
          </div>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.live_stream_enabled}
          onChange={(e) => setDraft((d) => ({ ...d, live_stream_enabled: e.target.checked }))}
          className="size-4 accent-primary"
        />
        {t('agent_cfg_live')}
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={update.isPending}>
          {t('q_save')}
        </Button>
        {saved && <span className="text-xs text-[#10b981]">{t('agent_cfg_saved')}</span>}
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    </form>
  );
}

export function QuarryAgentModal({ quarry, onClose }: { quarry: Quarry; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: status, isLoading } = useQuarryAgent(quarry.id);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-1">
          <Eyebrow className="text-slate-400">{t('agent_section')}</Eyebrow>
          <DialogTitle className="text-lg font-semibold">
            {t('agent_action', { name: quarry.name })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[65vh] auto-rows-max gap-4 overflow-y-auto py-1">
          {isLoading && !status ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : (
            <>
              {status?.token_issued_at && <StatusBlock status={status} />}
              <TokenBlock quarry={quarry} status={status} />
              {status?.config && <ConfigBlock quarryId={quarry.id} config={status.config} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
