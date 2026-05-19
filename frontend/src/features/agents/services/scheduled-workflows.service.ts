import { apiFetch } from '@/shared/utils/api';

export interface ScheduledWorkflow {
  id: string;
  projectId: string;
  name: string;
  agentType: string;
  prompt: string;
  scheduleCron: string;
  deliveryChannel: string;
  deliveryTarget: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface WorkflowRunHistoryItem {
  id: string;
  workflowId: string;
  ranAt: string;
  status: string;
  agentResponse: string | null;
  delivered: boolean;
  errorMessage: string | null;
}

export interface CreateWorkflowPayload {
  name: string;
  agentType: string;
  prompt: string;
  scheduleCron: string;
  deliveryChannel: string;
  deliveryTarget: string;
}

export async function getScheduledWorkflows(projectId: string): Promise<ScheduledWorkflow[]> {
  return apiFetch<ScheduledWorkflow[]>(`/projects/${projectId}/scheduled-workflows`);
}

export async function createScheduledWorkflow(
  projectId: string,
  payload: CreateWorkflowPayload,
): Promise<ScheduledWorkflow> {
  return apiFetch<ScheduledWorkflow>(`/projects/${projectId}/scheduled-workflows`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateScheduledWorkflow(
  projectId: string,
  workflowId: string,
  payload: Partial<CreateWorkflowPayload & { isActive: boolean }>,
): Promise<ScheduledWorkflow> {
  return apiFetch<ScheduledWorkflow>(`/projects/${projectId}/scheduled-workflows/${workflowId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteScheduledWorkflow(projectId: string, workflowId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/scheduled-workflows/${workflowId}`, { method: 'DELETE' });
}

export async function getWorkflowRunHistory(
  projectId: string,
  workflowId: string,
  limit = 20,
): Promise<WorkflowRunHistoryItem[]> {
  return apiFetch<WorkflowRunHistoryItem[]>(
    `/projects/${projectId}/scheduled-workflows/${workflowId}/history?limit=${limit}`,
  );
}
