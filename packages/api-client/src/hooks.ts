import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createEvent,
  createQuarry,
  deleteQuarry,
  getDistricts,
  getDynamics,
  getEvents,
  getHealth,
  getM1,
  getMaterials,
  getOverview,
  getQuarries,
  getRegionGeo,
  getRegions,
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

export function useDeleteQuarry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteQuarry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quarries'] }),
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

export function useRegions() {
  return useQuery({ queryKey: ['regions'], queryFn: getRegions });
}

export function useRegionGeo(regionId: string | undefined) {
  return useQuery({
    queryKey: ['region-geo', regionId],
    queryFn: () => getRegionGeo(regionId!),
    enabled: !!regionId,
  });
}

export function useOverview(params: { region_id?: string; district_id?: string } = {}) {
  return useQuery({ queryKey: ['overview', params], queryFn: () => getOverview(params) });
}

export function useDynamics(params: { year?: number; district_id?: string } = {}) {
  return useQuery({ queryKey: ['dynamics', params], queryFn: () => getDynamics(params) });
}

export function useM1(params: Record<string, string> = {}) {
  return useQuery({ queryKey: ['m1', params], queryFn: () => getM1(params) });
}
