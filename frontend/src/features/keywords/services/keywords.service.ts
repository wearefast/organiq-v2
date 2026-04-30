import { apiFetch } from '@/shared/utils/api';

interface KeywordProject {
  id: string;
  name: string;
  seedKeywords: string[];
  status: string;
}

export async function getKeywordProjects(): Promise<KeywordProject[]> {
  return apiFetch<KeywordProject[]>('/keywords');
}

export async function createKeywordProject(data: {
  name: string;
  seedKeywords: string[];
  competitors: string[];
}): Promise<KeywordProject> {
  return apiFetch<KeywordProject>('/keywords', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function triggerDiscovery(projectId: string): Promise<void> {
  await apiFetch(`/keywords/${projectId}/discover`, { method: 'POST' });
}

export async function triggerGapAnalysis(projectId: string): Promise<void> {
  await apiFetch(`/keywords/${projectId}/gap-analysis`, { method: 'POST' });
}
