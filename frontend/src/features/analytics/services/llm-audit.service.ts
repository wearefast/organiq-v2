import { apiFetch } from '@/shared/utils/api';

export type BotStatus = 'allowed' | 'blocked' | 'not_specified';

/** Keyed by bot user-agent string. New bots added server-side are automatically included. */
export type BotPermissions = Record<string, BotStatus>;

export interface ContentChecks {
  h1Present: boolean;
  hierarchyValid: boolean;
  metaDescriptionPresent: boolean;
  semanticHtml: boolean;
  imagesWithAlt: number;
  imagesTotal: number;
  jsRenderedOnly: boolean;
  // LLM discovery signals (optional — old stored rows pre-date this check)
  llmsTxtPresent?: boolean;
  llmsTxtValid?: boolean;
  pageInLlmsTxt?: boolean;
  llmsFullTxtPresent?: boolean; // /llms-full.txt full-content variant (used by Perplexity & Claude)
  // Content freshness signals (optional — old stored rows pre-date this check)
  dateModifiedPresent?: boolean;
  dateModifiedRecent?: boolean;
  sitemapHasLastmod?: boolean;
}

export interface TrustSignals {
  ssl: boolean;
  hasAboutPage: boolean;
  authorByline: boolean;
  schemaTypes: string[];
  ogTags: boolean;
  twitterTags: boolean;
  // E-E-A-T depth signals (optional — old stored rows pre-date this check)
  hasPersonSchema?: boolean;
  hasOrganizationSchema?: boolean;
  authorHasCredentials?: boolean;
  // Page-level robots directives (optional — old stored rows pre-date this check)
  metaRobotsNoindex?: boolean;
  metaRobotsNoai?: boolean;
  xRobotsNoindex?: boolean;
  xRobotsNoai?: boolean;
}

export interface ContentChunking {
  avgParagraphLength: number;
  hasLists: boolean;
  internalLinkCount: number;
  // Citation-readiness signals (optional — old stored rows pre-date this check)
  hasFaq?: boolean;
  hasComparisonTable?: boolean;
  hasStepList?: boolean;
  answerFirst?: boolean;
  hasOutboundLinks?: boolean;
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

export async function runLlmAudit(projectId: string): Promise<AuditRunSummary> {
  return apiFetch<AuditRunSummary>(
    `/projects/${projectId}/audit/llm/run`,
    { method: 'POST' },
  );
}

export async function fetchLatestAudit(projectId: string): Promise<AuditRunSummary | null> {
  return apiFetch<AuditRunSummary | null>(`/projects/${projectId}/audit/llm/latest`);
}

export async function fetchAuditHistory(projectId: string): Promise<AuditHistoryEntry[]> {
  return apiFetch<AuditHistoryEntry[]>(`/projects/${projectId}/audit/llm/history`);
}

export async function refreshProjectSitemap(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/refresh-sitemap`, { method: 'POST' });
}
