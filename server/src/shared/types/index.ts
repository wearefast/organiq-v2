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
