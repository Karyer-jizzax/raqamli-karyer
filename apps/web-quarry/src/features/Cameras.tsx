import { type Post, usePostCameras, useQuarryPosts } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  Chip,
  cn,
  EmptyState,
  PageHeader,
  TableSkeleton,
  TONE_DOT,
  useAuth,
} from '@karier/ui';
import { CameraIcon, VideoIcon } from 'lucide-react';

/** One post with its cameras. Read-only — provisioning stays in web-main. */
function PostSection({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { data: cameras, isLoading } = usePostCameras(post.id);
  const list = cameras ?? [];
  const activeCount = list.filter((c) => c.is_active).length;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Chip tone="neutral" className="bg-primary-tint text-primary tabular-nums">
            {post.code}
          </Chip>
          <b className="truncate text-data text-foreground">{post.name}</b>
        </div>
        <span className="text-2xs text-muted-foreground tabular-nums">
          {t('dash_cameras_active')}: <b className="text-foreground">{activeCount}</b> / {list.length}
        </span>
      </header>

      {isLoading ? (
        <TableSkeleton rows={2} cols={4} />
      ) : list.length === 0 ? (
        <EmptyState title={t('cam_empty')} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
          {list.map((c) => {
            const Icon = c.kind === 'plate' ? CameraIcon : VideoIcon;
            return (
              <article
                key={c.id}
                className="flex items-start gap-2.5 rounded-xl border bg-surface-subtle px-3 py-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-card text-primary">
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-block size-[9px] shrink-0 rounded-full',
                        TONE_DOT[c.is_active ? 'success' : 'danger'],
                      )}
                      title={t(c.is_active ? 'q_st_active' : 'dash_cameras_inactive')}
                    />
                    <b className="truncate text-data text-foreground">{c.name}</b>
                    <span className="ml-auto shrink-0 text-2xs text-muted-foreground tabular-nums">
                      {c.code}
                    </span>
                  </div>
                  <div className="mt-0.5 text-2xs text-muted-foreground">
                    {t(c.kind === 'plate' ? 'camera_kind_plate' : 'camera_kind_record')}
                    {c.ip && <> · <span className="tabular-nums">{c.ip}</span></>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function Cameras() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const quarryId = user?.quarry_id ?? undefined;
  const { data: posts, isLoading } = useQuarryPosts(quarryId);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_quarry')}
        title={t('nav_cameras')}
        subtitle={t('cam_subtitle')}
      />
      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : (posts ?? []).length === 0 ? (
        <EmptyState title={t('post_empty')} />
      ) : (
        (posts ?? []).map((p) => <PostSection key={p.id} post={p} />)
      )}
    </div>
  );
}
