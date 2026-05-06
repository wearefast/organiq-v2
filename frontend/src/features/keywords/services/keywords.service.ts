import { apiFetch } from '@/shared/utils/api';

export interface KeywordWorkflowSummary {
  id: string;
  projectId: string;
  language: 'en';
  country: string;
  status: 'DRAFT' | 'RUNNING' | 'AWAITING_APPROVAL' | 'REVISION_REQUESTED' | 'APPROVED' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';
  currentStep: string | null;
  currentCheckpoint: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordProject {
  id: string;
  name: string;
  websiteUrl: string;
  seedKeywords: string[];
  competitors: string[] | null;
  createdAt: string;
  keywords?: Array<{
    id: string;
    workflowRunId: string | null;
    keyword: string;
    searchVolume: number | null;
    intent: string;
    funnel: string;
    targetUrl: string | null;
    parentTopic: string | null;
    sourceMethods: string[] | null;
    approvalStatus: string;
    dedupeStatus: string;
    existingCoverageUrl?: string | null;
    contentType?: string | null;
    notes?: string | null;
  }>;
  workflows?: KeywordWorkflowSummary[];
}

export interface PersistedKeywordWorkflowKeyword {
  id: string;
  workflowRunId: string | null;
  keyword: string;
  searchVolume: number | null;
  intent: string;
  funnel: string;
  targetUrl: string | null;
  parentTopic: string | null;
  sourceMethods: string[] | null;
  approvalStatus: string;
  dedupeStatus: string;
  existingCoverageUrl: string | null;
  contentType: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

export interface PersistedKeywordWorkflowTopicalMap {
  id: string;
  projectId: string;
  workflowRunId: string | null;
  name: string;
  language: string;
  country: string | null;
  structure: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordWorkflowArtifactApproval {
  id: string;
  artifactId: string;
  decision: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED';
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string;
}

export interface KeywordWorkflowContentGapImport {
  id: string;
  workflowRunId: string;
  format: 'csv' | 'tsv' | 'plain-text';
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface KeywordWorkflowCompetitorMetrics {
  id: string;
  competitorId: string;
  domainRating: number | null;
  organicTraffic: number | null;
  organicKeywords: number | null;
  referringDomains: number | null;
  backlinks: number | null;
  topPages: Record<string, unknown>[];
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordWorkflowCompetitor {
  id: string;
  projectId: string;
  workflowRunId: string;
  domain: string;
  bucket: 'DIRECT' | 'ORGANIC' | 'UNCLASSIFIED';
  status: 'CANDIDATE' | 'APPROVED' | 'REJECTED';
  rationale: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  metrics?: KeywordWorkflowCompetitorMetrics | null;
}

export interface KeywordWorkflowArtifact {
  id: string;
  workflowRunId: string;
  stepKey: string;
  version: number;
  status: 'DRAFT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED' | 'SUPERSEDED';
  summary: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  approvals?: KeywordWorkflowArtifactApproval[];
}

export interface KeywordWorkflow {
  id: KeywordWorkflowSummary['id'];
  projectId: KeywordWorkflowSummary['projectId'];
  language: KeywordWorkflowSummary['language'];
  country: KeywordWorkflowSummary['country'];
  status: KeywordWorkflowSummary['status'];
  currentStep: KeywordWorkflowSummary['currentStep'];
  currentCheckpoint: KeywordWorkflowSummary['currentCheckpoint'];
  startedAt: KeywordWorkflowSummary['startedAt'];
  completedAt: KeywordWorkflowSummary['completedAt'];
  createdBy: KeywordWorkflowSummary['createdBy'];
  createdAt: KeywordWorkflowSummary['createdAt'];
  updatedAt: KeywordWorkflowSummary['updatedAt'];
  competitors?: KeywordWorkflowCompetitor[];
  contentGapImports?: KeywordWorkflowContentGapImport[];
  artifacts?: KeywordWorkflowArtifact[];
  persistedKeywords?: PersistedKeywordWorkflowKeyword[];
  persistedTopicalMaps?: PersistedKeywordWorkflowTopicalMap[];
}

export async function getKeywordProjects(): Promise<KeywordProject[]> {
  return apiFetch<KeywordProject[]>('/keywords/projects', { cache: 'no-store' });
}

export async function createKeywordProject(data: {
  name: string;
  websiteUrl: string;
  seedKeywords: string[];
}): Promise<KeywordProject> {
  return apiFetch<KeywordProject>('/keywords/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getKeywordProject(projectId: string): Promise<KeywordProject> {
  return apiFetch<KeywordProject>(`/keywords/projects/${projectId}`, { cache: 'no-store' });
}

export async function createKeywordWorkflow(projectId: string, data: { language?: 'en'; country: string }): Promise<KeywordWorkflow> {
  return apiFetch<KeywordWorkflow>(`/keywords/projects/${projectId}/workflows`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getKeywordWorkflow(projectId: string, workflowId: string): Promise<KeywordWorkflow> {
  return apiFetch<KeywordWorkflow>(`/keywords/projects/${projectId}/workflows/${workflowId}`, {
    cache: 'no-store',
  });
}

export async function createKeywordWorkflowArtifact(
  projectId: string,
  workflowId: string,
  data: {
    stepKey: string;
    summary?: Record<string, unknown>;
    payload: Record<string, unknown>;
  },
): Promise<KeywordWorkflowArtifact> {
  return apiFetch<KeywordWorkflowArtifact>(`/keywords/projects/${projectId}/workflows/${workflowId}/artifacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createKeywordWorkflowContentGapImport(
  projectId: string,
  workflowId: string,
  data: {
    rawImport: string;
    notes?: string;
  },
): Promise<KeywordWorkflowContentGapImport> {
  return apiFetch<KeywordWorkflowContentGapImport>(`/keywords/projects/${projectId}/workflows/${workflowId}/content-gap-imports`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createKeywordWorkflowCompetitor(
  projectId: string,
  workflowId: string,
  data: {
    domain: string;
    bucket?: 'DIRECT' | 'ORGANIC' | 'UNCLASSIFIED';
    status?: 'CANDIDATE' | 'APPROVED' | 'REJECTED';
    rationale?: string;
    notes?: string;
  },
): Promise<KeywordWorkflowCompetitor> {
  return apiFetch<KeywordWorkflowCompetitor>(`/keywords/projects/${projectId}/workflows/${workflowId}/competitors`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function upsertKeywordWorkflowCompetitorMetrics(
  projectId: string,
  workflowId: string,
  competitorId: string,
  data: {
    domainRating?: number;
    organicTraffic?: number;
    organicKeywords?: number;
    referringDomains?: number;
    backlinks?: number;
    topPages?: Record<string, unknown>[];
    capturedAt?: string;
  },
): Promise<KeywordWorkflowCompetitorMetrics> {
  return apiFetch<KeywordWorkflowCompetitorMetrics>(
    `/keywords/projects/${projectId}/workflows/${workflowId}/competitors/${competitorId}/metrics`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function getKeywordWorkflowCheckpoint(
  projectId: string,
  workflowId: string,
  stepKey: string,
): Promise<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }> {
  return apiFetch<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }>(
    `/keywords/projects/${projectId}/workflows/${workflowId}/checkpoints/${stepKey}`,
    { cache: 'no-store' },
  );
}

export async function approveKeywordWorkflowCheckpoint(
  projectId: string,
  workflowId: string,
  stepKey: string,
  notes?: string,
): Promise<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }> {
  return apiFetch<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }>(
    `/keywords/projects/${projectId}/workflows/${workflowId}/checkpoints/${stepKey}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ notes }),
    },
  );
}

export async function requestKeywordWorkflowRevision(
  projectId: string,
  workflowId: string,
  stepKey: string,
  notes?: string,
): Promise<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }> {
  return apiFetch<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }>(
    `/keywords/projects/${projectId}/workflows/${workflowId}/checkpoints/${stepKey}/request-revision`,
    {
      method: 'POST',
      body: JSON.stringify({ notes }),
    },
  );
}

export async function rejectKeywordWorkflowCheckpoint(
  projectId: string,
  workflowId: string,
  stepKey: string,
  notes?: string,
): Promise<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }> {
  return apiFetch<{ workflowId: string; stepKey: string; artifact: KeywordWorkflowArtifact }>(
    `/keywords/projects/${projectId}/workflows/${workflowId}/checkpoints/${stepKey}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ notes }),
    },
  );
}

export async function triggerDiscovery(projectId: string): Promise<void> {
  await apiFetch(`/keywords/projects/${projectId}/discover`, { method: 'POST' });
}

export async function triggerGapAnalysis(projectId: string): Promise<void> {
  await apiFetch(`/keywords/projects/${projectId}/gap-analysis`, { method: 'POST' });
}

// ─── Step Generation ─────────────────────────────────────────

export interface WorkflowJob {
  id: string;
  workflowRunId: string;
  stepKey: string;
  jobType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  error: string | null;
  resultArtifactId: string | null;
  inputPayload: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export async function generateWorkflowStep(
  projectId: string,
  workflowId: string,
  stepKey: string,
): Promise<WorkflowJob> {
  return apiFetch(
    `/keywords/projects/${projectId}/workflows/${workflowId}/steps/${stepKey}/generate`,
    { method: 'POST' },
  );
}

export async function getWorkflowJobStatus(
  projectId: string,
  workflowId: string,
  jobId: string,
): Promise<WorkflowJob> {
  return apiFetch(
    `/keywords/projects/${projectId}/workflows/${workflowId}/jobs/${jobId}`,
  );
}
