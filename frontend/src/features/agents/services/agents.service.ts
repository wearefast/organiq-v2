import { apiFetch } from '@/shared/utils/api';

export interface AgentType {
  type: string;
  label: string;
  creditCost: number;
}

export interface AgentRunResponse {
  id: string;
  agentType: string;
  agentLabel: string;
  response: string;
  recommendations: Array<{ title: string; rationale: string; action?: string }>;
  citedData: Array<{ metric: string; value: string; source: string }>;
  dataContextSummary: string;
  creditCost: number;
  durationMs: number;
}

export interface AgentRunHistory {
  id: string;
  agentType: string;
  userPrompt: string;
  response: string | null;
  status: 'running' | 'completed' | 'failed';
  creditCost: number;
  createdAt: string;
}

export async function runAgent(
  projectId: string,
  prompt: string,
  agentType?: string,
): Promise<AgentRunResponse> {
  return apiFetch<AgentRunResponse>(`/projects/${projectId}/agents/run`, {
    method: 'POST',
    body: JSON.stringify({ prompt, agentType }),
  });
}

export async function getAgentHistory(
  projectId: string,
  limit = 20,
): Promise<AgentRunHistory[]> {
  return apiFetch<AgentRunHistory[]>(`/projects/${projectId}/agents/history?limit=${limit}`);
}

export async function getAgentTypes(projectId: string): Promise<AgentType[]> {
  return apiFetch<AgentType[]>(`/projects/${projectId}/agents/types`);
}
