import { apiFetch } from '@/shared/utils/api';
import type {
  WorkflowRun,
  WorkflowRunDetail,
  ApprovalDecision,
} from '../types';

const BASE = '/workflows';

export async function createRun(
  projectId: string,
  organizationId: string,
): Promise<WorkflowRun> {
  return apiFetch<WorkflowRun>(BASE, {
    method: 'POST',
    body: JSON.stringify({ projectId, organizationId }),
  });
}

export async function startRun(runId: string): Promise<WorkflowRun> {
  return apiFetch<WorkflowRun>(`${BASE}/${runId}/start`, {
    method: 'POST',
  });
}

export async function resumeRun(runId: string): Promise<{ enqueued: string[] }> {
  return apiFetch<{ enqueued: string[] }>(`${BASE}/${runId}/resume`, {
    method: 'POST',
  });
}

export async function getRun(runId: string): Promise<WorkflowRunDetail> {
  return apiFetch<WorkflowRunDetail>(`${BASE}/${runId}`);
}

export async function listRuns(projectId: string): Promise<WorkflowRun[]> {
  return apiFetch<WorkflowRun[]>(`${BASE}/project/${projectId}`);
}

export async function approveStep(
  runId: string,
  stepKey: string,
  notes?: string,
): Promise<{ step: string; decision: ApprovalDecision }> {
  return apiFetch(`${BASE}/${runId}/steps/${stepKey}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function reviseStep(
  runId: string,
  stepKey: string,
  notes: string,
): Promise<{ step: string; decision: ApprovalDecision }> {
  return apiFetch(`${BASE}/${runId}/steps/${stepKey}/revise`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectStep(
  runId: string,
  stepKey: string,
  notes: string,
): Promise<{ step: string; decision: ApprovalDecision }> {
  return apiFetch(`${BASE}/${runId}/steps/${stepKey}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function getContext(
  runId: string,
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`${BASE}/${runId}/context`);
}

export async function rerunStep(
  runId: string,
  stepKey: string,
): Promise<{ rerun: string; cascadeReset: string[] }> {
  return apiFetch<{ rerun: string; cascadeReset: string[] }>(
    `${BASE}/${runId}/steps/${stepKey}/rerun`,
    { method: 'POST' },
  );
}
