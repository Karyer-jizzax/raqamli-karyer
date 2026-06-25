// Typed fetch wrapper. Generated OpenAPI types live in ./generated/schema.ts
// (regenerate with `pnpm --filter @karier/api-client generate` while backend runs).

import type { Role } from '@karier/types';

const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '/api/v1';
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers });
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
  code: string;
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

export async function getHealth(): Promise<{ status: string }> {
  const resp = await fetch('/health');
  if (!resp.ok) throw new ApiError(resp.status, 'health failed');
  return (await resp.json()) as { status: string };
}

export const getMaterials = () => api.get<Material[]>('/materials');
export const getDistricts = (regionId?: string) =>
  api.get<District[]>(`/districts${regionId ? `?region_id=${regionId}` : ''}`);
export interface EventRecord {
  id: string;
  quarry_id: string;
  plate_region: string;
  plate_number: string;
  model: string;
  direction: string;
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
  status: 'confirm' | 'flagged' | 'inspect';
  owner_name: string;
  stir: string;
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
  length_m: number;
  width_m: number;
  height_m: number;
  owner_name: string;
  stir: string;
}

export const getEvents = () => api.get<EventRecord[]>('/events');
export const createEvent = (body: EventInput) => api.post<EventRecord>('/events', body);

// ── video / AI detection ────────────────────────────────────────────────────
export interface Detection {
  plate_region: string;
  plate_number: string;
  model: string;
  material_id: string;
  bbox: number[]; // [x, y, w, h] normalized 0..1
  length_m: number;
  width_m: number;
  height_m: number;
  weight_kg: number;
  density: number;
  plate_confidence: number;
  type_confidence: number;
}

export interface AnalyzeResponse {
  detection: Detection;
  media_id: string | null;
  media_url: string | null;
}

async function postForm<T>(path: string, file: File | null): Promise<T> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const fd = new FormData();
  if (file) fd.append('file', file);
  const resp = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: fd });
  if (!resp.ok) throw new ApiError(resp.status, `Request failed: ${resp.status}`);
  return (await resp.json()) as T;
}

export const analyzeFrame = (file: File | null) =>
  postForm<AnalyzeResponse>('/video/analyze', file);
export const ingestFrame = (file: File | null) =>
  postForm<{ event: EventRecord; detection: Detection; media_url: string | null }>(
    '/video/ingest',
    file,
  );

// ── stats / geo (department) ────────────────────────────────────────────────
export interface Overview {
  quarries: number;
  districts: number;
  cameras: number;
  organizations: number;
  events: number;
  total_volume: number;
  avg_confidence: number;
}

export interface DistrictGeo {
  id: string;
  code: string;
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
  plate_region: string;
  plate_number: string;
  model: string;
  direction: string;
  occurred_at: string;
  material_id: string | null;
  volume_final: number;
  volume_confidence: number;
  payer_type: string;
  owner_name: string;
  status: 'confirm' | 'flagged' | 'inspect';
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
  code: string;
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
export const getOverview = (params: { region_id?: string; district_id?: string } = {}) => {
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

export const getQuarries = () => api.get<Quarry[]>('/quarries');
export const createQuarry = (body: {
  district_id: string;
  name: string;
  code: string;
}) => api.post<Quarry>('/quarries', body);
export const deleteQuarry = (id: string) => api.del(`/quarries/${id}`);
