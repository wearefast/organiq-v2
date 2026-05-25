import { apiFetch } from '@/shared/utils/api';

export interface PromptWithStats {
  id: string;
  promptText: string;
  intentStage: string | null;
  engines: string[];
  isActive: boolean;
  createdAt: string;
  latestVisibilityPct: number | null;
  latestMentionPosition: number | null;
  lastCheckedAt: string | null;
}

export interface VisibilityOverview {
  overallScore: number;
  totalPrompts: number;
  activePrompts: number;
  avgVisibilityPct: number;
  avgPosition: number | null;
  byEngine: Array<{ engine: string; visibilityPct: number; checks: number }>;
}

export interface PromptHistoryEntry {
  id: string;
  aiEngine: string;
  checkedAt: string;
  brandMentioned: boolean;
  mentionPosition: number | null;
  responseExcerpt: string | null;
  sentiment: string | null;
  visibilityPct: string | null;
}

export async function fetchPrompts(projectId: string): Promise<PromptWithStats[]> {
  return apiFetch<PromptWithStats[]>(`/projects/${projectId}/prompts`);
}

export async function createPrompt(
  projectId: string,
  body: { promptText: string; intentStage?: string; engines?: string[] },
): Promise<PromptWithStats> {
  return apiFetch<PromptWithStats>(`/projects/${projectId}/prompts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deletePrompt(projectId: string, promptId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/prompts/${promptId}`, { method: 'DELETE' });
}

export async function togglePrompt(projectId: string, promptId: string, isActive: boolean): Promise<void> {
  await apiFetch(`/projects/${projectId}/prompts/${promptId}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function fetchPromptHistory(projectId: string, promptId: string): Promise<PromptHistoryEntry[]> {
  return apiFetch<PromptHistoryEntry[]>(`/projects/${projectId}/prompts/${promptId}/history`);
}

export async function fetchVisibilityOverview(projectId: string): Promise<VisibilityOverview> {
  return apiFetch<VisibilityOverview>(`/projects/${projectId}/prompts/overview`);
}

export async function fetchSupportedEngines(projectId: string): Promise<{ engines: string[] }> {
  return apiFetch<{ engines: string[] }>(`/projects/${projectId}/prompts/engines`);
}

export interface PromptSuggestion {
  text: string;
  intent: string;
  category: string;
}

export async function fetchPromptSuggestions(projectId: string): Promise<PromptSuggestion[]> {
  return apiFetch<PromptSuggestion[]>(`/projects/${projectId}/prompts/suggestions`);
}
