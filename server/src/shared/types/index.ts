// ─── Audit Steps ─────────────────────────────────────────────
export enum AuditStep {
  SCRAPE = 'SCRAPE',
  PAGESPEED = 'PAGESPEED',
  BUSINESS_PROFILE = 'BUSINESS_PROFILE',
  DOMAIN_METRICS = 'DOMAIN_METRICS',
  COMPETITOR_DISCOVERY = 'COMPETITOR_DISCOVERY',
  COMPETITOR_METRICS = 'COMPETITOR_METRICS',
  CONTENT_GAP = 'CONTENT_GAP',
  SCORING = 'SCORING',
  REPORT_GENERATION = 'REPORT_GENERATION',
}

// ─── Business Profile ────────────────────────────────────────
export interface BusinessProfile {
  brandIdentity: string;
  targetMarket: string;
  services: string[];
  geography: string;
  toneOfVoice: string;
  seedKeywords: string[];
}

// ─── Domain Metrics ──────────────────────────────────────────
export interface DomainMetrics {
  domainRating: number;
  referringDomains: number;
  backlinks: number;
  estimatedMonthlyTraffic: number;
  totalKeywords: number;
}

// ─── Competitor ──────────────────────────────────────────────
export interface CompetitorData {
  domain: string;
  type: 'direct' | 'organic';
  metrics: DomainMetrics;
  topPages: { url: string; traffic: number; topKeyword?: string }[];
  hasBlog: boolean;
  blogUrl?: string;
}

// ─── Scrape Result ───────────────────────────────────────────
export interface ScrapeResult {
  title: string;
  metaDescription: string;
  h1s: string[];
  bodyText: string;
  internalLinkCount: number;
  imageAltCoverage: number;
  schemaMarkupPresent: boolean;
  siteName: string;
  ogImage: string;
  favicon: string;
}

// ─── PageSpeed ───────────────────────────────────────────────
export interface PageSpeedMetrics {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  lcp: number;
  cls: number;
  fid: number;
}

export interface PageSpeedResult {
  mobile: PageSpeedMetrics;
  desktop: PageSpeedMetrics;
}

// ─── Audit Scores ────────────────────────────────────────────
export interface AuditScores {
  technicalSeo: number;
  contentCoverage: number;
  backlinkAuthority: number;
  aeoGeoReadiness: number;
  overall: number;
}

// ─── Job Payloads ────────────────────────────────────────────
export interface AuditJobPayload {
  auditId: string;
  leadId: string;
  websiteUrl: string;
}

export enum KeywordWorkflowStatus {
  DRAFT = 'DRAFT',
  RUNNING = 'RUNNING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
}

export enum KeywordWorkflowArtifactStatus {
  DRAFT = 'DRAFT',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum KeywordWorkflowDecision {
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REJECTED = 'REJECTED',
}

export enum KeywordDedupeStatus {
  KEPT = 'KEPT',
  DUPLICATE_EXISTING = 'DUPLICATE_EXISTING',
  DUPLICATE_CROSS_METHOD = 'DUPLICATE_CROSS_METHOD',
  IRRELEVANT = 'IRRELEVANT',
  REJECTED = 'REJECTED',
}

export enum KeywordApprovalStatus {
  CANDIDATE = 'CANDIDATE',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type WorkflowLanguageCode = 'en';

export type KeywordWorkflowStepKey =
  | 'business-profile'
  | 'seed-keywords'
  | 'serp-niche-map'
  | 'competitor-buckets'
  | 'competitor-metrics'
  | 'phase1-baseline'
  | 'method01-competitor-pages'
  | 'method02-seed-expansion'
  | 'method03-content-gap-import'
  | 'consolidated-keywords'
  | 'topical-map'
  | 'content-brief'
  | 'content-article';

export type KeywordSourceMethod =
  | 'phase1'
  | 'method01-competitor-pages'
  | 'method02-matching-terms'
  | 'method02-related-terms'
  | 'method03-content-gap-import'
  | 'manual-review';

export interface KeywordWorkflowRunRecord {
  id: string;
  projectId: string;
  language: WorkflowLanguageCode;
  country: string;
  status: KeywordWorkflowStatus;
  currentStep: KeywordWorkflowStepKey | null;
  currentCheckpoint: KeywordWorkflowStepKey | null;
}

export interface KeywordWorkflowArtifactRecord {
  id: string;
  workflowRunId: string;
  stepKey: KeywordWorkflowStepKey;
  status: KeywordWorkflowArtifactStatus;
  summary: Record<string, unknown> | null;
  payload: Record<string, unknown>;
}

export interface KeywordWorkflowApprovalRecord {
  id: string;
  artifactId: string;
  decision: KeywordWorkflowDecision;
  notes: string | null;
  reviewedBy: string | null;
}

export interface KeywordJobPayload {
  projectId: string;
  action: 'discover' | 'expand' | 'gap-analysis';
}

export interface ContentJobPayload {
  keywordId: string;
  action: 'generate-brief' | 'generate-article';
}

// ─── Audit Progress ──────────────────────────────────────────
export interface AuditProgress {
  auditId: string;
  step: string;
  progress: number;
  message: string;
}
