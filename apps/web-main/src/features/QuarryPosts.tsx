import {
  ApiError,
  type Camera,
  type CameraKind,
  type Post,
  type Quarry,
  useCreateCamera,
  useCreatePost,
  useDeleteCamera,
  useDeletePost,
  usePostCameras,
  useQuarryPosts,
  useUpdateCamera,
  useUpdatePost,
} from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UiButton as Button,
} from '@karier/ui';
import {
  CameraIcon,
  CheckIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Eyebrow, ModalForm, ROW_ACTION, ROW_ACTION_DANGER, slugCode } from '../shared';

const CAMERA_KIND_LABEL: Record<CameraKind, string> = {
  plate: 'camera_kind_plate',
  record: 'camera_kind_record',
};

// ── delete confirmations (stacked on top of the manage dialog) ──────────────
function ConfirmDeletePostModal({
  post,
  quarryId,
  onClose,
}: {
  post: Post;
  quarryId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const del = useDeletePost();
  const [err, setErr] = useState('');

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await del.mutateAsync({ id: post.id, quarryId });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('post_delete_title')}
      onClose={onClose}
      onSubmit={onConfirm}
      err={err}
      pending={del.isPending}
      submitLabel={t('q_yes')}
      cancelLabel={t('q_no')}
    >
      <p className="text-sm">{t('post_delete_confirm', { name: post.name })}</p>
    </ModalForm>
  );
}

function ConfirmDeleteCameraModal({
  camera,
  postId,
  onClose,
}: {
  camera: Camera;
  postId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const del = useDeleteCamera();
  const [err, setErr] = useState('');

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await del.mutateAsync({ id: camera.id, postId });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <ModalForm
      title={t('camera_delete_title')}
      onClose={onClose}
      onSubmit={onConfirm}
      err={err}
      pending={del.isPending}
      submitLabel={t('q_yes')}
      cancelLabel={t('q_no')}
    >
      <p className="text-sm">{t('camera_delete_confirm', { name: camera.name })}</p>
    </ModalForm>
  );
}

// ── inline add forms ─────────────────────────────────────────────────────────
function AddPostForm({ quarryId, onDone }: { quarryId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const create = useCreatePost();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await create.mutateAsync({ quarryId, body: { code: slugCode(name), name: name.trim() } });
      setName('');
      onDone();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-2 rounded-lg border border-dashed p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('post_name')}
        className="min-w-40 flex-1"
        required
      />
      <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
        <PlusIcon />
        {t('post_add')}
      </Button>
      {err && <span className="w-full text-xs text-destructive">{err}</span>}
    </form>
  );
}

function AddCameraForm({ postId, onDone }: { postId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const create = useCreateCamera();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CameraKind>('plate');
  const [streamUrl, setStreamUrl] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await create.mutateAsync({
        postId,
        body: {
          code: slugCode(name),
          name: name.trim(),
          kind,
          stream_url: streamUrl.trim() || undefined,
        },
      });
      setName('');
      setStreamUrl('');
      onDone();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Error');
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('camera_name')}
        required
      />
      <Select value={kind} onValueChange={(v) => setKind(v as CameraKind)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="plate">{t('camera_kind_plate')}</SelectItem>
          <SelectItem value="record">{t('camera_kind_record')}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={streamUrl}
        onChange={(e) => setStreamUrl(e.target.value)}
        placeholder={t('camera_stream_url')}
        className="sm:col-span-2"
      />
      <Button
        type="submit"
        size="sm"
        className="justify-self-start sm:col-span-2"
        disabled={create.isPending || !name.trim()}
      >
        <PlusIcon />
        {t('camera_add')}
      </Button>
      {err && <span className="text-xs text-destructive sm:col-span-2">{err}</span>}
    </form>
  );
}

// ── camera row (view + inline edit) ──────────────────────────────────────────
function CameraRow({ camera, postId }: { camera: Camera; postId: string }) {
  const { t } = useTranslation();
  const update = useUpdateCamera();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(camera.name);
  const [streamUrl, setStreamUrl] = useState(camera.stream_url ?? '');
  const [deleting, setDeleting] = useState(false);

  async function onSave() {
    await update.mutateAsync({
      id: camera.id,
      body: { name: name.trim(), stream_url: streamUrl.trim() || null },
    });
    setEditing(false);
  }

  const Icon = camera.kind === 'plate' ? CameraIcon : VideoIcon;

  if (editing) {
    return (
      <div className="grid gap-2 rounded-[11px] border border-[#f1f5f9] bg-[#f8fafc] p-2.5 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder={t('camera_stream_url')}
        />
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="ghost" onClick={onSave} disabled={update.isPending}>
            <CheckIcon />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(false)}>
            <XIcon />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-transparent bg-[#f8fafc] px-3.5 py-2.5 transition-colors hover:bg-[#f1f5f9]">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{camera.name}</span>
        <Badge variant="outline" className="bg-card">
          {t(CAMERA_KIND_LABEL[camera.kind])}
        </Badge>
        {camera.stream_url && (
          <span className="hidden truncate text-[11px] text-slate-400 sm:inline">
            {camera.stream_url}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={camera.is_active}
            onChange={(e) => update.mutate({ id: camera.id, body: { is_active: e.target.checked } })}
            className="size-3.5 accent-primary"
          />
          {t('camera_active')}
        </label>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={ROW_ACTION}
          onClick={() => setEditing(true)}
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={ROW_ACTION_DANGER}
          onClick={() => setDeleting(true)}
        >
          <Trash2Icon />
        </Button>
      </div>
      {deleting && (
        <ConfirmDeleteCameraModal camera={camera} postId={postId} onClose={() => setDeleting(false)} />
      )}
    </div>
  );
}

// ── post card: header + its cameras ──────────────────────────────────────────
function PostCard({ post, quarryId }: { post: Post; quarryId: string }) {
  const { t } = useTranslation();
  const { data: cameras, isLoading } = usePostCameras(post.id);
  const update = useUpdatePost();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(post.name);
  const [deleting, setDeleting] = useState(false);
  const [addingCamera, setAddingCamera] = useState(false);

  async function onSave() {
    await update.mutateAsync({ id: post.id, body: { name: name.trim() } });
    setEditing(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] bg-[#fbfcfe] px-4 py-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-64" />
            <Button type="button" size="icon" variant="ghost" onClick={onSave} disabled={update.isPending}>
              <CheckIcon />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(false)}>
              <XIcon />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <MapPinIcon className="size-4 text-primary" />
              <span className="text-sm font-semibold">{post.name}</span>
              <span className="text-[11px] text-slate-400">{post.code}</span>
            </div>
            <div className="flex gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={ROW_ACTION}
                onClick={() => setEditing(true)}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={ROW_ACTION_DANGER}
                onClick={() => setDeleting(true)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-2 p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : !cameras?.length ? (
          <p className="text-sm text-muted-foreground">{t('camera_empty')}</p>
        ) : (
          cameras.map((c) => <CameraRow key={c.id} camera={c} postId={post.id} />)
        )}

        {addingCamera ? (
          <AddCameraForm postId={post.id} onDone={() => setAddingCamera(false)} />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setAddingCamera(true)}
          >
            <PlusIcon />
            {t('camera_add')}
          </Button>
        )}
      </div>

      {deleting && (
        <ConfirmDeletePostModal post={post} quarryId={quarryId} onClose={() => setDeleting(false)} />
      )}
    </div>
  );
}

// ── top-level modal: all posts + their cameras for one quarry ───────────────
export function QuarryPostsModal({ quarry, onClose }: { quarry: Quarry; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: posts, isLoading } = useQuarryPosts(quarry.id);
  const [addingPost, setAddingPost] = useState(false);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="gap-1">
          <Eyebrow className="text-slate-400">{t('q_posts_title')}</Eyebrow>
          <DialogTitle className="text-lg font-semibold">
            {t('q_posts_manage', { name: quarry.name })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : !posts?.length ? (
            <p className="text-sm text-muted-foreground">{t('post_empty')}</p>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} quarryId={quarry.id} />)
          )}

          {addingPost ? (
            <AddPostForm quarryId={quarry.id} onDone={() => setAddingPost(false)} />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setAddingPost(true)}
            >
              <PlusIcon />
              {t('post_add')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
