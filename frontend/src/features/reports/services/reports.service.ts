import { apiFetch } from '@/shared/utils/api';

export interface Report {
  id: string;
  projectId: string;
  workflowRunId: string | null;
  type: 'full_strategy' | 'ai_visibility' | 'keyword_research' | 'content_plan';
  title: string;
  filePath: string | null;
  generatedAt: string | null;
  createdAt: string;
}

export interface GenerateReportPayload {
  workflowRunId: string;
  type: Report['type'];
}

export function fetchReports(projectId: string): Promise<Report[]> {
  return apiFetch(`/projects/${projectId}/reports`);
}

export function fetchReport(projectId: string, id: string): Promise<Report> {
  return apiFetch(`/projects/${projectId}/reports/${id}`);
}

export function generateReport(projectId: string, payload: GenerateReportPayload): Promise<Report> {
  return apiFetch(`/projects/${projectId}/reports/generate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteReport(projectId: string, id: string): Promise<void> {
  return apiFetch(`/projects/${projectId}/reports/${id}`, { method: 'DELETE' });
}

export function getReportDownloadUrl(projectId: string, id: string): string {
  return `/projects/${projectId}/reports/${id}/download`;
}
