import { apiFetch } from '@/shared/utils/api';

export interface BotPermissions {
  GPTBot: 'allowed' | 'blocked' | 'not_specified';
  ClaudeBot: 'allowed' | 'blocked' | 'not_specified';
  PerplexityBot: 'allowed' | 'blocked' | 'not_specified';
  'Google-Extended': 'allowed' | 'blocked' | 'not_specified';
  Applebot: 'allowed' | 'blocked' | 'not_specified';
  'cohere-ai': 'allowed' | 'blocked' | 'not_specified';
}

export interface ContentChecks {
  h1Present: boolean;
  hierarchyValid: boolean;
  metaDescriptionPresent: boolean;
  semanticHtml: boolean;
  imagesWithAlt: number;
  imagesTotal: number;
  jsRenderedOnly: boolean;
}

export interface TrustSignals {
  ssl: boolean;
  hasAboutPage: boolean;
  authorByline: boolean;
  schemaTypes: string[];
  ogTags: boolean;
  twitterTags: boolean;
}

export interface ContentChunking {
  avgParagraphLength: number;
  hasLists: boolean;
  internalLinkCount: number;
}

export interface AuditIssue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  fix: string;
}

export interface PageAuditResult {
  pageUrl: string;
  aiIndexabilityScore: number;
  botPermissions: BotPermissions;
  contentChecks: ContentChecks;
  trustSignals: TrustSignals;
  contentChunking: ContentChunking;
  issues: AuditIssue[];
}

export interface AuditRunSummary {
  auditRunId: string;
  projectId: string;
  overallScore: number;
  pageCount: number;
  results: PageAuditResult[];
  auditedAt: string;
}

export interface AuditHistoryEntry {
  auditRunId: string;
  overallScore: number;
  pageCount: number;
  auditedAt: string;
}

export async function runLlmAudit(projectId: string, url: string): Promise<AuditRunSummary> {
  return apiFetch<AuditRunSummary>(
    `/projects/${projectId}/audit/llm/run?url=${encodeURIComponent(url)}`,
    { method: 'POST' },
  );
}

export async function fetchLatestAudit(projectId: string): Promise<AuditRunSummary | null> {
  return apiFetch<AuditRunSummary | null>(`/projects/${projectId}/audit/llm/latest`);
}

export async function fetchAuditHistory(projectId: string): Promise<AuditHistoryEntry[]> {
  return apiFetch<AuditHistoryEntry[]>(`/projects/${projectId}/audit/llm/history`);
}
