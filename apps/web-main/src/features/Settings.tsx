import { ApiError, useTripRules, useUpdateTripRules } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { Input, Label, UiButton as Button } from '@karier/ui';
import { CheckIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { Eyebrow } from '../shared';

/** Runtime trip rules (superadmin): netto floor + violation timeout.
    Values live in the backend app_settings table — no redeploy needed. */
export function Settings() {
  const { t } = useTranslation();
  const { data, isLoading } = useTripRules();
  const update = useUpdateTripRules();
  const [minNetto, setMinNetto] = useState('');
  const [timeoutHours, setTimeoutHours] = useState('');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the form once the current values arrive.
  useEffect(() => {
    if (data) {
      setMinNetto(String(data.trip_min_netto_kg));
      setTimeoutHours(String(data.trip_open_timeout_hours));
    }
  }, [data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setSaved(false);
    try {
      await update.mutateAsync({
        trip_min_netto_kg: Number(minNetto),
        trip_open_timeout_hours: Number(timeoutHours),
      });
      setSaved(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <div className="max-w-[560px] rounded-2xl border bg-card p-5">
      <Eyebrow className="text-slate-400">{t('set_trip_rules')}</Eyebrow>
      <h2 className="mt-1 mb-4 text-lg font-semibold">{t('set_trip_rules_title')}</h2>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="set-min-netto">{t('set_min_netto')}</Label>
            <Input
              id="set-min-netto"
              type="number"
              min={0}
              max={100000}
              required
              value={minNetto}
              onChange={(e) => {
                setMinNetto(e.target.value);
                setSaved(false);
              }}
              className="max-w-56"
            />
            <p className="text-xs text-muted-foreground">{t('set_min_netto_hint')}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="set-timeout">{t('set_timeout')}</Label>
            <Input
              id="set-timeout"
              type="number"
              min={1}
              max={168}
              required
              value={timeoutHours}
              onChange={(e) => {
                setTimeoutHours(e.target.value);
                setSaved(false);
              }}
              className="max-w-56"
            />
            <p className="text-xs text-muted-foreground">{t('set_timeout_hint')}</p>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={update.isPending}>
              {t('q_save')}
            </Button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-[#059669]">
                <CheckIcon className="size-4" />
                {t('set_saved')}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{t('set_apply_note')}</p>
        </form>
      )}
    </div>
  );
}
