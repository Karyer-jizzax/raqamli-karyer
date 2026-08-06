import { useQuarryAgent } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  AgentStatusStrip,
  EmptyState,
  LiveGrid,
  PageHeader,
  TableSkeleton,
  useAuth,
} from '@karier/ui';

/**
 * Karyerni "hozir" ko'rish. Rejimni agent tanlaydi (kanal tezligiga qarab),
 * bu sahifa faqat holatni o'qiydi va shu rejimni chizadi — doc.txt §3.5.
 */
export function Live() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const quarryId = user?.quarry_id ?? undefined;
  const { data: agent, isLoading } = useQuarryAgent(quarryId);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader eyebrow={t('sec_quarry')} title={t('nav_live')} subtitle={t('live_subtitle')} />

      {isLoading && !agent ? (
        <TableSkeleton rows={2} cols={2} />
      ) : !agent || !agent.is_active ? (
        <EmptyState title={t('agent_none')} hint={t('agent_none_hint')} />
      ) : (
        <>
          <AgentStatusStrip status={agent} />
          <LiveGrid status={agent} />
        </>
      )}
    </div>
  );
}
