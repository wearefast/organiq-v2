import { apiFetch, API_URL } from '@/shared/utils/api';

export interface GscStatus {
  connected: boolean;
  siteUrl?: string;
  lastSyncAt?: string;
  syncStatus?: string;
}

export interface GscKeyword {
  id: string;
  query: string;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
  date: string;
  country: string | null;
  device: string | null;
}

export interface GscPerformanceSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
}

export function getGscConnectUrl(projectId: string, organizationId: string): string {
  return `${API_URL}/projects/${projectId}/gsc/connect?organizationId=${organizationId}`;
}

export async function fetchGscStatus(projectId: string): Promise<GscStatus> {
  return apiFetch<GscStatus>(`/projects/${projectId}/gsc/status`);
}

export async function fetchGscKeywords(
  projectId: string,
  params?: { startDate?: string; endDate?: string; limit?: number },
): Promise<GscKeyword[]> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  return apiFetch<GscKeyword[]>(`/projects/${projectId}/gsc/keywords${qs ? `?${qs}` : ''}`);
}

export async function fetchGscSummary(
  projectId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<GscPerformanceSummary> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  const qs = searchParams.toString();
  return apiFetch<GscPerformanceSummary>(`/projects/${projectId}/gsc/summary${qs ? `?${qs}` : ''}`);
}
