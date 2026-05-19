import { apiFetch } from '@/shared/utils/api';

export interface TrafficOverview {
  totalSessions: number;
  byEngine: Array<{ engine: string; sessions: number }>;
  dailyTrend: Array<{ date: string; sessions: number }>;
  topPages: Array<{ page: string; sessions: number }>;
}

export interface EngineInfo {
  id: string;
  name: string;
  color: string;
}

export async function fetchTrafficOverview(
  projectId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<TrafficOverview> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  const qs = searchParams.toString();
  return apiFetch<TrafficOverview>(`/projects/${projectId}/traffic/overview${qs ? `?${qs}` : ''}`);
}

export async function fetchEngines(projectId: string): Promise<EngineInfo[]> {
  const result = await apiFetch<{ engines: EngineInfo[] }>(`/projects/${projectId}/traffic/engines`);
  return result.engines;
}
