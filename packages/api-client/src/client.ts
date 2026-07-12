// Typed fetch wrapper. Generated OpenAPI types live in ./generated/schema.ts
// (regenerate with `pnpm --filter @karier/api-client generate` while backend runs).

import type { Role } from '@karier/types';

const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '/api/v1';

// Media (photos/video) are served from the backend root at /media/... — not
// under the /api/v1 prefix. Resolve a stored url against the backend origin so
// it works whether API_BASE is same-origin ('/api/v1') or absolute.
const MEDIA_ORIGIN = (() => {
  try {
    return API_BASE.startsWith('http') ? new URL(API_BASE).origin : '';
  } catch {
    return '';
  }
})();

/** Turn a backend media path ('/media/x.jpg') into a browser-loadable URL. */
export const mediaUrl = (path: string | null | undefined): string =>
  !path ? '' : /^https?:\/\//.test(path) ? path : `${MEDIA_ORIGIN}${path}`;

const TOKEN_KEY = 'kk_access_token';
const REFRESH_KEY = 'kk_refresh_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Access tokens are short-lived (15 min). When one expires, a request gets a
// 401; we transparently exchange the long-lived refresh token for a fresh pair
// and retry once, so the user is not bounced to the login screen mid-session.
// Concurrent 401s share a single in-flight refresh to avoid a stampede.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) {
      // Refresh token itself is invalid/expired — session is truly over.
      setToken(null);
      setRefreshToken(null);
      return false;
    }
    const data = (await resp.json()) as TokenResponse;
    setToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

function ensureRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshTokens().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Try a one-shot token refresh on the first 401, then replay the request.
  if (resp.status === 401 && retry && getRefreshToken()) {
    const refreshed = await ensureRefresh();
    if (refreshed) return request<T>(path, init, false);
  }

  if (!resp.ok) {
    let detail = `Request failed: ${resp.status}`;
    try {
      const j = (await resp.json()) as { detail?: string };
      if (j.detail) detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(resp.status, detail);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => request<void>(path, { method: 'DELETE' }),
};

// ── domain types (mirror backend schemas) ──────────────────────────────────
export interface AuthUserDto {
  id: string;
  username: string;
  email: string | null;
  full_name: string;
  role: Role;
  quarry_id: string | null;
  region_id: string | null;
  // Returned by /users (management endpoints); absent on /auth/me.
  is_active?: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUserDto;
}

export interface District {
  id: string;
  region_id: string;
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
  is_capital: boolean;
}

export interface Quarry {
  id: string;
  district_id: string;
  organization_id: string | null;
  name: string;
  code: string;
  status: string;
}

export interface Material {
  id: string;
  default_density: number;
  density_min: number;
  density_max: number;
  is_tent: boolean;
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
}

// ── endpoints ───────────────────────────────────────────────────────────────
export async function login(username: string, password: string): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/login', { username, password });
  setToken(res.access_token);
  setRefreshToken(res.refresh_token);
  return res;
}

export function getMe(): Promise<AuthUserDto> {
  return api.get<AuthUserDto>('/auth/me');
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return api.post<void>('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function getHealth(): Promise<{ status: string }> {
  // /health lives at the backend root, not under /api/v1. MEDIA_ORIGIN is ''
  // in dev (vite proxies /health) and the absolute backend origin in production
  // (VITE_API_BASE is a full URL), so this resolves correctly in both.
  const resp = await fetch(`${MEDIA_ORIGIN}/health`);
  if (!resp.ok) throw new ApiError(resp.status, 'health failed');
  return (await resp.json()) as { status: string };
}

export const getMaterials = () => api.get<Material[]>('/materials');
export interface MaterialInput {
  id: string;
  default_density: number;
  density_min: number;
  density_max: number;
  is_tent?: boolean;
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
}
export const createMaterial = (body: MaterialInput) => api.post<Material>('/materials', body);
export const updateMaterial = (id: string, body: Partial<Omit<MaterialInput, 'id'>>) =>
  api.patch<Material>(`/materials/${id}`, body);
export const deleteMaterial = (id: string) => api.del(`/materials/${id}`);
export const getQuarryMaterials = (quarryId: string) =>
  api.get<Material[]>(`/quarries/${quarryId}/materials`);
export const setQuarryMaterials = (quarryId: string, materialIds: string[]) =>
  api.put<Material[]>(`/quarries/${quarryId}/materials`, { material_ids: materialIds });
export const getDistricts = (regionId?: string) =>
  api.get<District[]>(`/districts${regionId ? `?region_id=${regionId}` : ''}`);
export interface EventRecord {
  id: string;
  quarry_id: string;
  plate_region: string;
  plate_number: string;
  model: string;
  direction: string;
  is_main: boolean;
  occurred_at: string;
  payer_type: string;
  material_id: string | null;
  density: number;
  weight_kg: number;
  volume_camera: number | null;
  volume_scale: number;
  volume_final: number;
  diff_pct: number | null;
  volume_confidence: number;
  // no_plate = ANPR raqamni o'qiy olmagan — operator qo'lda kiritadi
  status: 'confirm' | 'flagged' | 'inspect' | 'no_plate';
  owner_name: string;
  stir: string;
  image_urls: string[];
  video_url: string | null;
}

export interface EventInput {
  plate_region: string;
  plate_number: string;
  model: string;
  direction: string;
  payer_type: string;
  material_id: string;
  density: number;
  weight_kg: number;
  owner_name: string;
  stir: string;
  // Which physical post/camera captured this event (falls back to the
  // quarry's first post/camera server-side if omitted).
  post_id?: string;
  camera_id?: string;
}

export const getEvents = () => api.get<EventRecord[]>('/events');
export const createEvent = (body: EventInput) => api.post<EventRecord>('/events', body);
// Manual plate fix for a "no_plate" event — the server re-links it to its trip.
export const updateEventPlate = (id: string, body: { plate_region: string; plate_number: string }) =>
  api.patch<EventRecord>(`/events/${id}/plate`, body);

// ── trips (qatnovlar) — kon exit → main enter → main exit chains, produced
// server-side by the ingest linker; the UI only reads them ────────────────────
export interface TripStage {
  event_id: string;
  occurred_at: string;
  image_urls: string[];
  video_url: string | null;
}

export interface TripRecord {
  id: string;
  quarry_id: string;
  plate_region: string;
  plate_number: string;
  kind: 'karyer' | 'tashqi';
  // no_cargo = netto below the floor (staff car); incomplete = violation
  status: 'open' | 'done' | 'incomplete' | 'no_cargo';
  // derived progress from which checkpoints have fired (status chip)
  stage: 'karyerda' | 'yolda' | 'zavodda' | 'yakunlandi' | 'chala' | 'yuk_emas';
  kon_enter_event_id: string | null;
  kon_exit_event_id: string | null;
  main_enter_event_id: string | null;
  main_exit_event_id: string | null;
  enter_weight_kg: number | null;
  exit_weight_kg: number | null;
  netto_kg: number | null;
  started_at: string;
  completed_at: string | null;
  kon_enter_at: string | null;
  kon_exit_at: string | null;
  main_enter_at: string | null;
  main_exit_at: string | null;
  // per-stage media (linked events' snapshots + clip) for the detail modal
  kon_enter: TripStage | null;
  kon_exit: TripStage | null;
  main_enter: TripStage | null;
  main_exit: TripStage | null;
}

export interface TripParams {
  quarry_id?: string;
  plate?: string;
  status?: string;
  kind?: string;
  limit?: string;
  offset?: string;
}

export const getTrips = (params: TripParams = {}) => {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => !!v)) as Record<string, string>,
  ).toString();
  return api.get<TripRecord[]>(`/trips${q ? `?${q}` : ''}`);
};

// ── scale (tarozi) ───────────────────────────────────────────────────────────
export interface ScaleReading {
  weight_kg: number;
}
export const getScaleReading = (plateRegion: string, plateNumber: string) =>
  api.get<ScaleReading>(
    `/scale/reading?plate_region=${encodeURIComponent(plateRegion)}&plate_number=${encodeURIComponent(plateNumber)}`,
  );

// ── video / AI detection (plate + material recognition only — weight comes
// from the scale, not the camera) ───────────────────────────────────────────
export interface Detection {
  plate_region: string;
  plate_number: string;
  model: string;
  material_id: string;
  bbox: number[]; // [x, y, w, h] normalized 0..1
  plate_confidence: number;
  type_confidence: number;
}

export interface AnalyzeResponse {
  detection: Detection;
  media_id: string | null;
  media_url: string | null;
}

async function postForm<T>(
  path: string,
  file: File | null,
  fields: Record<string, string | undefined> = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const fd = new FormData();
  if (file) fd.append('file', file);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.append(key, value);
  }
  const resp = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: fd });
  if (!resp.ok) throw new ApiError(resp.status, `Request failed: ${resp.status}`);
  return (await resp.json()) as T;
}

export const analyzeFrame = (file: File | null) =>
  postForm<AnalyzeResponse>('/video/analyze', file);
export const ingestFrame = (
  file: File | null,
  refs: { postId?: string; cameraId?: string } = {},
) =>
  postForm<{ event: EventRecord; detection: Detection; media_url: string | null }>(
    '/video/ingest',
    file,
    { post_id: refs.postId, camera_id: refs.cameraId },
  );

// ── stats / geo (department) ────────────────────────────────────────────────
export interface Overview {
  quarries: number;
  districts: number;
  cameras: number;
  cameras_active: number;
  cameras_inactive: number;
  organizations: number;
  events: number;
  total_volume: number;
  avg_confidence: number;
}

export interface QuarryStats {
  events: number;
  trucks: number;
  volume: number;
  loaded: number;
  not_loaded: number;
  unidentified: number;
  cameras: number;
  cameras_active: number;
  cameras_inactive: number;
  last_event_at: string | null;
}

export interface CargoPost {
  id: string;
  code: string;
  name: string;
  events: number;
  trucks: number;
  cameras: number;
  cameras_active: number;
}

export interface CargoQuarryRow {
  id: string;
  name: string;
  count: number;
  volume: number;
}

export interface DistrictCargo {
  trucks_total: number;
  loaded: number;
  not_loaded: number;
  unidentified: number;
  posts: CargoPost[];
  quarries: CargoQuarryRow[];
  last_event_at: string | null;
}

export interface DateRangeParams {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
}

export interface DistrictGeo {
  id: string;
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
  is_capital: boolean;
  svg_path: string | null;
  center_x: number | null;
  center_y: number | null;
  quarry_count: number;
  event_count: number;
}

export interface RegionGeo {
  region_id: string;
  view_height: number;
  districts: DistrictGeo[];
}

export interface M1Row {
  id: string;
  post_code: string | null;
  camera_label: string | null;
  plate_region: string;
  plate_number: string;
  model: string;
  vtype: string;
  direction: string;
  is_main: boolean;
  occurred_at: string;
  is_loaded: boolean;
  material_id: string | null;
  weight_kg: number;
  density: number;
  volume_final: number;
  volume_confidence: number;
  material_confidence: number;
  payer_type: string;
  stir: string;
  owner_name: string;
  status: 'confirm' | 'flagged' | 'inspect' | 'no_plate';
  image_urls: string[];
  video_url: string | null;
}

export interface M1Response {
  rows: M1Row[];
  total_count: number;
  total_volume: number;
}

export interface DynamicsBucket {
  month: number;
  total: number;
  confirmed: number;
  detection_pct: number;
}

export interface DynamicsResponse {
  year: number;
  buckets: DynamicsBucket[];
  total_events: number;
  avg_detection: number;
}

export interface Region {
  id: string;
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
}

export interface ProtocolDocument {
  protocol: {
    id: string;
    event_id: string;
    number: string;
    verification_code: string;
    qr_payload: string;
    inspector_name: string;
    operator_name: string;
    driver_name: string;
    normative_basis: string;
    issued_at: string;
  };
  event: EventRecord & {
    length_m: number;
    width_m: number;
    height_m: number;
  };
  qr_svg: string;
  quarry_name: string;
  district_name_uz_latn: string;
  region_name_uz_latn: string;
  material_name_uz_latn: string | null;
  organization: string;
}

export interface ReportRow {
  key: string;
  count: number;
  volume: number;
}
export interface ReportResponse {
  report: string;
  dimension: string;
  rows: ReportRow[];
}

export const createProtocol = (
  eventId: string,
  signatures: { inspector_name?: string; operator_name?: string; driver_name?: string } = {},
) => api.post<ProtocolDocument>(`/events/${eventId}/protocol`, signatures);
export const getEventProtocol = (eventId: string) =>
  api.get<ProtocolDocument>(`/events/${eventId}/protocol`);
export const getReport = (n: number) => api.get<ReportResponse>(`/stats/reports/${n}`);

export const getRegions = () => api.get<Region[]>('/regions');
export const getRegionGeo = (regionId: string) => api.get<RegionGeo>(`/regions/${regionId}/geo`);

// ── region / district CRUD (superadmin) ──────────────────────────────────────
export interface RegionInput {
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
}
export const createRegion = (body: RegionInput) => api.post<Region>('/regions', body);
export const updateRegion = (id: string, body: Partial<RegionInput>) =>
  api.patch<Region>(`/regions/${id}`, body);
export const deleteRegion = (id: string) => api.del(`/regions/${id}`);

export interface DistrictInput {
  region_id: string;
  name_uz_latn: string;
  name_uz_cyrl: string;
  name_ru: string;
  is_capital?: boolean;
}
export const createDistrict = (body: DistrictInput) => api.post<District>('/districts', body);
export const updateDistrict = (id: string, body: Partial<DistrictInput>) =>
  api.patch<District>(`/districts/${id}`, body);
export const deleteDistrict = (id: string) => api.del(`/districts/${id}`);
export const getOverview = (
  params: { region_id?: string; district_id?: string; year?: string; month?: string } = {},
) => {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return api.get<Overview>(`/stats/overview${q ? `?${q}` : ''}`);
};
export const getDynamics = (params: { year?: number; district_id?: string } = {}) => {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
  ).toString();
  return api.get<DynamicsResponse>(`/stats/dynamics${q ? `?${q}` : ''}`);
};
export const getM1 = (params: Record<string, string> = {}) => {
  const q = new URLSearchParams(params).toString();
  return api.get<M1Response>(`/stats/m1${q ? `?${q}` : ''}`);
};

const dateRangeQuery = (params: DateRangeParams): string => {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => !!v)) as Record<string, string>,
  ).toString();
  return q ? `?${q}` : '';
};

export const getQuarryStats = (quarryId: string, params: DateRangeParams = {}) =>
  api.get<QuarryStats>(`/stats/quarries/${quarryId}${dateRangeQuery(params)}`);
export const getDistrictCargo = (districtId: string, params: DateRangeParams = {}) =>
  api.get<DistrictCargo>(`/stats/districts/${districtId}/cargo${dateRangeQuery(params)}`);

// ── posts / cameras (superadmin — physical camera topology per quarry) ──────
// Two fixed posts per quarry: the entrance gate (in/out control) and the
// weighbridge post at the factory. Each post's pole carries two cameras:
// `plate` (ANPR) and `record` (evidentiary video — does not measure volume).
export interface Post {
  id: string;
  quarry_id: string;
  code: string;
  name: string;
}
export interface PostInput {
  code: string;
  name: string;
}
export type CameraKind = 'plate' | 'record';
export type CameraBrand = 'dahua' | 'hikvision';
export interface Camera {
  id: string;
  post_id: string;
  code: string;
  name: string;
  kind: CameraKind;
  stream_url: string | null;
  is_active: boolean;
  brand: CameraBrand;
  ip: string | null;
  login: string | null;
  password: string | null;
}
export interface CameraInput {
  code: string;
  name: string;
  kind?: CameraKind;
  stream_url?: string | null;
  brand?: CameraBrand;
  ip?: string | null;
  login?: string | null;
  password?: string | null;
}
export const getQuarryPosts = (quarryId: string) =>
  api.get<Post[]>(`/quarries/${quarryId}/posts`);
export const createPost = (quarryId: string, body: PostInput) =>
  api.post<Post>(`/quarries/${quarryId}/posts`, body);
export const updatePost = (id: string, body: Partial<PostInput>) =>
  api.patch<Post>(`/posts/${id}`, body);
export const deletePost = (id: string) => api.del(`/posts/${id}`);

export const getPostCameras = (postId: string) => api.get<Camera[]>(`/posts/${postId}/cameras`);
export const createCamera = (postId: string, body: CameraInput) =>
  api.post<Camera>(`/posts/${postId}/cameras`, body);
export const updateCamera = (
  id: string,
  body: Partial<Pick<Camera, 'name' | 'stream_url' | 'is_active' | 'brand' | 'ip' | 'login' | 'password'>>,
) => api.patch<Camera>(`/cameras/${id}`, body);
export const deleteCamera = (id: string) => api.del(`/cameras/${id}`);

// ── local-server provisioning (superadmin) ──────────────────────────────────
// One paste-able token the quarry local server exchanges at
// GET /api/local/config for its full configuration (quarry code, ingest
// api_key, expected camera names) — no manual copying.
export interface ProvisionToken {
  token: string;
  expires_hours: number;
  quarry_code: string;
}
export const createProvisionToken = (quarryId: string) =>
  api.post<ProvisionToken>(`/quarries/${quarryId}/provision-token`, {
    // The public backend origin the local server should call. MEDIA_ORIGIN is
    // '' when API_BASE is same-origin — fall back to the page origin.
    server_url: MEDIA_ORIGIN || window.location.origin,
  });

export const getQuarries = () => api.get<Quarry[]>('/quarries');
export const createQuarry = (body: {
  district_id: string;
  name: string;
  code: string;
}) => api.post<Quarry>('/quarries', body);
export const updateQuarry = (
  id: string,
  body: { name?: string; status?: 'active' | 'suspended' },
) => api.patch<Quarry>(`/quarries/${id}`, body);
export const deleteQuarry = (id: string) => api.del(`/quarries/${id}`);

// ── users (superadmin) ───────────────────────────────────────────────────────
export interface UserCreateInput {
  username: string;
  password: string;
  full_name?: string;
  email?: string | null;
  role?: Role;
  quarry_id?: string | null;
  region_id?: string | null;
}
export const createUser = (body: UserCreateInput) => api.post<AuthUserDto>('/users', body);
export const getUsers = (params: { quarry_id?: string } = {}) => {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return api.get<AuthUserDto[]>(`/users${q ? `?${q}` : ''}`);
};
export interface UserUpdateInput {
  full_name?: string;
  email?: string | null;
  password?: string;
  is_active?: boolean;
  region_id?: string | null;
  quarry_id?: string | null;
}
export const updateUser = (id: string, body: UserUpdateInput) =>
  api.patch<AuthUserDto>(`/users/${id}`, body);
