import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createAgentToken,
  getQuarryAgent,
  revokeAgentToken,
  updateAgentConfig,
  type AgentConfig,
  createCamera,
  createDistrict,
  createEvent,
  createMaterial,
  createPost,
  createProvisionToken,
  createQuarry,
  createRegion,
  createUser,
  deleteCamera,
  deleteDistrict,
  deleteMaterial,
  deletePost,
  deleteQuarry,
  deleteRegion,
  getUsers,
  updateCamera,
  updateDistrict,
  updateEventPlate,
  updateMaterial,
  updatePost,
  updateQuarry,
  updateRegion,
  updateUser,
  type UserUpdateInput,
  getDistricts,
  getDynamics,
  getEvents,
  getHealth,
  getDistrictCargo,
  getM1,
  getMaterials,
  getTrips,
  type TripParams,
  getPublicWaybill,
  getTripWaybill,
  getOverview,
  getQuarryStats,
  getPostCameras,
  getQuarryMaterials,
  getQuarryPosts,
  getReport,
  type ReportParams,
  getTripRules,
  updateTripRules,
  type TripRules,
  getQuarries,
  getRegionGeo,
  getRegions,
  getScaleReading,
  setQuarryMaterials,
  type Camera,
  type CameraInput,
  type DateRangeParams,
  type MaterialInput,
  type Post,
  type PostInput,
} from './client';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
    refetchInterval: 10_000,
  });
}

export function useMaterials() {
  return useQuery({ queryKey: ['materials'], queryFn: getMaterials });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMaterial,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<MaterialInput, 'id'>> }) =>
      updateMaterial(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

export function useQuarryMaterials(quarryId: string | undefined) {
  return useQuery({
    queryKey: ['quarry-materials', quarryId],
    queryFn: () => getQuarryMaterials(quarryId!),
    enabled: !!quarryId,
  });
}

export function useSetQuarryMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quarryId, materialIds }: { quarryId: string; materialIds: string[] }) =>
      setQuarryMaterials(quarryId, materialIds),
    onSuccess: (_data, { quarryId }) =>
      qc.invalidateQueries({ queryKey: ['quarry-materials', quarryId] }),
  });
}

export function useDistricts(regionId?: string) {
  return useQuery({ queryKey: ['districts', regionId], queryFn: () => getDistricts(regionId) });
}

export function useQuarries() {
  return useQuery({ queryKey: ['quarries'], queryFn: getQuarries });
}

export function useCreateQuarry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuarry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quarries'] }),
  });
}

export function useUpdateQuarry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; status?: 'active' | 'suspended' } }) =>
      updateQuarry(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quarries'] }),
  });
}

export function useDeleteQuarry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteQuarry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quarries'] }),
  });
}

export function useProvisionToken() {
  return useMutation({ mutationFn: createProvisionToken });
}

// ── tarozi punkti agenti ─────────────────────────────────────────────────────
// Agent har 60 soniyada heartbeat yuboradi (doc.txt §3.3) — kartani 30
// soniyada yangilaymiz, shunda "online → offline" o'tishi bir daqiqadan
// ko'proq kechikmaydi.
export function useQuarryAgent(quarryId: string | undefined, poll = true) {
  return useQuery({
    queryKey: ['quarry-agent', quarryId],
    queryFn: () => getQuarryAgent(quarryId!),
    enabled: !!quarryId,
    refetchInterval: poll ? 30_000 : false,
    placeholderData: (prev) => prev,
  });
}

export function useCreateAgentToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAgentToken,
    onSuccess: (_d, quarryId) => qc.invalidateQueries({ queryKey: ['quarry-agent', quarryId] }),
  });
}

export function useRevokeAgentToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeAgentToken,
    onSuccess: (_d, quarryId) => qc.invalidateQueries({ queryKey: ['quarry-agent', quarryId] }),
  });
}

export function useUpdateAgentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quarryId, body }: { quarryId: string; body: Partial<AgentConfig> }) =>
      updateAgentConfig(quarryId, body),
    onSuccess: (_d, { quarryId }) =>
      qc.invalidateQueries({ queryKey: ['quarry-agent', quarryId] }),
  });
}

export function useQuarryPosts(quarryId: string | undefined) {
  return useQuery({
    queryKey: ['quarry-posts', quarryId],
    queryFn: () => getQuarryPosts(quarryId!),
    enabled: !!quarryId,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quarryId, body }: { quarryId: string; body: PostInput }) =>
      createPost(quarryId, body),
    onSuccess: (data: Post) => qc.invalidateQueries({ queryKey: ['quarry-posts', data.quarry_id] }),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<PostInput> }) => updatePost(id, body),
    onSuccess: (data: Post) => qc.invalidateQueries({ queryKey: ['quarry-posts', data.quarry_id] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; quarryId: string }) => deletePost(id),
    onSuccess: (_d, { quarryId }) => qc.invalidateQueries({ queryKey: ['quarry-posts', quarryId] }),
  });
}

export function usePostCameras(postId: string | undefined) {
  return useQuery({
    queryKey: ['post-cameras', postId],
    queryFn: () => getPostCameras(postId!),
    enabled: !!postId,
  });
}

export function useCreateCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: CameraInput }) =>
      createCamera(postId, body),
    onSuccess: (data: Camera) => qc.invalidateQueries({ queryKey: ['post-cameras', data.post_id] }),
  });
}

export function useUpdateCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<Pick<Camera, 'name' | 'stream_url' | 'is_active' | 'brand' | 'ip' | 'login' | 'password'>>;
    }) => updateCamera(id, body),
    onSuccess: (data: Camera) => qc.invalidateQueries({ queryKey: ['post-cameras', data.post_id] }),
  });
}

export function useDeleteCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; postId: string }) => deleteCamera(id),
    onSuccess: (_d, { postId }) => qc.invalidateQueries({ queryKey: ['post-cameras', postId] }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUsers(params: { quarry_id?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => getUsers(params),
    enabled,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdateInput }) => updateUser(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: getEvents });
}

export function useUpdateEventPlate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { plate_region: string; plate_number: string };
    }) => updateEventPlate(id, body),
    onSuccess: () => {
      // The fixed event changes the M-1 log, the events list AND (via
      // re-linking) the trips table.
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['m1'] });
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useScaleReading() {
  return useMutation({
    mutationFn: ({ plateRegion, plateNumber }: { plateRegion: string; plateNumber: string }) =>
      getScaleReading(plateRegion, plateNumber),
  });
}

export function useRegions() {
  return useQuery({ queryKey: ['regions'], queryFn: getRegions });
}

export function useCreateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRegion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regions'] }),
  });
}

export function useUpdateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<{
        name_uz_latn: string;
        name_uz_cyrl: string;
        name_ru: string;
      }>;
    }) => updateRegion(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regions'] }),
  });
}

export function useDeleteRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRegion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regions'] }),
  });
}

export function useCreateDistrict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDistrict,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['districts'] }),
  });
}

export function useUpdateDistrict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<{
        region_id: string;
        name_uz_latn: string;
        name_uz_cyrl: string;
        name_ru: string;
        is_capital: boolean;
      }>;
    }) => updateDistrict(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['districts'] }),
  });
}

export function useDeleteDistrict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDistrict,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['districts'] }),
  });
}

export function useRegionGeo(regionId: string | undefined) {
  return useQuery({
    queryKey: ['region-geo', regionId],
    queryFn: () => getRegionGeo(regionId!),
    enabled: !!regionId,
  });
}

export function useOverview(
  params: { region_id?: string; district_id?: string; year?: string; month?: string } = {},
) {
  return useQuery({
    queryKey: ['overview', params],
    queryFn: () => getOverview(params),
    // Changing the period must not blank the tiles — hold the last numbers
    // (the card dims them) instead of flashing an empty state.
    placeholderData: (prev) => prev,
  });
}

export function useQuarryStats(quarryId: string | undefined, params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['quarry-stats', quarryId, params],
    queryFn: () => getQuarryStats(quarryId!, params),
    enabled: !!quarryId,
    placeholderData: (prev) => prev,
  });
}

export function useDistrictCargo(districtId: string | undefined, params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['district-cargo', districtId, params],
    queryFn: () => getDistrictCargo(districtId!, params),
    enabled: !!districtId,
  });
}

export function useReport(n: number, params: ReportParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['report', n, params],
    queryFn: () => getReport(n, params),
    enabled,
    // Analytics cards re-fetch as the period changes; keep the old numbers on
    // screen (dimmed by the card) instead of flashing a skeleton.
    placeholderData: (prev) => prev,
  });
}

export function useDynamics(params: { year?: number; district_id?: string } = {}) {
  return useQuery({
    queryKey: ['dynamics', params],
    queryFn: () => getDynamics(params),
    placeholderData: (prev) => prev,
  });
}

export function useM1(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['m1', params],
    queryFn: () => getM1(params),
    placeholderData: (prev) => prev,
  });
}

export function useTrips(params: TripParams = {}) {
  return useQuery({ queryKey: ['trips', params], queryFn: () => getTrips(params) });
}

/** Yuk xati for a trip (authed). Idle until a trip is actually picked. */
export function useTripWaybill(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['waybill', tripId],
    queryFn: () => getTripWaybill(tripId as string),
    enabled: Boolean(tripId),
  });
}

/** The same document read without a token — the page a QR scan lands on. */
export function usePublicWaybill(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['waybill-public', tripId],
    queryFn: () => getPublicWaybill(tripId as string),
    enabled: Boolean(tripId),
    // A mistyped/expired link is a 404, not a hiccup — do not hammer it.
    retry: false,
  });
}

export function useTripRules() {
  return useQuery({ queryKey: ['trip-rules'], queryFn: getTripRules });
}

export function useUpdateTripRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TripRules) => updateTripRules(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-rules'] });
      // The open-timeout rule is applied when trips are READ — refetch them.
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
