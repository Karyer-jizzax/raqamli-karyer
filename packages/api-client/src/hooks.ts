import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCamera,
  createDistrict,
  createEvent,
  createMaterial,
  createPost,
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
  getOverview,
  getQuarryStats,
  getPostCameras,
  getQuarryMaterials,
  getQuarryPosts,
  getReport,
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
      body: Partial<Pick<Camera, 'name' | 'stream_url' | 'is_active'>>;
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
  return useQuery({ queryKey: ['overview', params], queryFn: () => getOverview(params) });
}

export function useQuarryStats(quarryId: string | undefined, params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['quarry-stats', quarryId, params],
    queryFn: () => getQuarryStats(quarryId!, params),
    enabled: !!quarryId,
  });
}

export function useDistrictCargo(districtId: string | undefined, params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['district-cargo', districtId, params],
    queryFn: () => getDistrictCargo(districtId!, params),
    enabled: !!districtId,
  });
}

export function useReport(n: number, enabled = true) {
  return useQuery({ queryKey: ['report', n], queryFn: () => getReport(n), enabled });
}

export function useDynamics(params: { year?: number; district_id?: string } = {}) {
  return useQuery({ queryKey: ['dynamics', params], queryFn: () => getDynamics(params) });
}

export function useM1(params: Record<string, string> = {}) {
  return useQuery({ queryKey: ['m1', params], queryFn: () => getM1(params) });
}
