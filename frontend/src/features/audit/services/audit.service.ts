import { apiFetch } from '@/shared/utils/api';

interface SubmitAuditPayload {
  websiteUrl: string;
  name: string;
  email: string;
  businessDescription: string;
  countries: string[];
}

interface SubmitAuditResponse {
  auditId: string;
  leadId: string;
}

export async function submitAudit(payload: SubmitAuditPayload): Promise<SubmitAuditResponse> {
  return apiFetch<SubmitAuditResponse>('/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

interface AuditStatusResponse {
  auditId: string;
  status: string;
  currentStep: string;
  step: string;
  progress: number;
  message: string;
  completedSteps: Array<{
    key: string;
    label: string;
    summary: Record<string, unknown>;
  }>;
  scores: Record<string, number> | null;
}

export async function getAuditStatus(auditId: string): Promise<AuditStatusResponse> {
  return apiFetch<AuditStatusResponse>(`/audits/${auditId}/status`);
}

// ─── Audit Detail ────────────────────────────────────────────

export interface ScrapeData {
  title: string;
  metaDescription: string;
  h1s: string[];
  bodyText: string;
  internalLinkCount: number;
  imageAltCoverage: number;
  schemaMarkupPresent: boolean;
}

export interface BusinessProfileData {
  brandIdentity: string;
  targetMarket: string;
  services: string[];
  geography: string;
  toneOfVoice: string;
  operationalModel: string;
  seedKeywords: string[];
  serviceAreas?: Array<{ area: string; region: string; country: string }>;
}

export interface PageSpeedMetricsData {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  lcp: number;
  cls: number;
  fid: number;
}

export interface DeepReadData {
  whatTheySell: string;
  whoTheyServe: string;
  howTheyPosition: string;
  whatMakesThemDifferent: string;
}

export interface KeywordResearchData {
  coreKeywords: Array<{
    keyword: string;
    volume: number | null;
    difficulty: number | null;
    confidence: 'high' | 'medium';
    reason: string;
  }>;
  moneyKeywords: Array<{
    keyword: string;
    volume: number | null;
    difficulty: number | null;
    intent: string;
    mappedService: string;
  }>;
  primaryTopics: Array<{
    pillar: string;
    clusterKeywords: string[];
    estimatedTotalVolume: number;
  }>;
  nicheEntities: Array<{
    entity: string;
    type: string;
    relevance: string;
  }>;
  seedExpansions: string[];
  coreTopics: Array<{
    topicName: string;
    type: string;
    relatedTerms: string[];
    intent: string;
    mappedTo: string | null;
  }>;
}

export interface CompetitorData {
  directCompetitors: Array<{ domain: string; reason: string }>;
  organicCompetitors: Array<{ domain: string; reason: string }>;
}

export interface CompetitorMetricsData {
  clientMetrics: {
    domain: string;
    domainRating: number;
    ahrefsRank: number | null;
    backlinks: number;
    referringDomains: number;
    orgKeywords: number;
    orgTraffic: number;
    orgCost: number | null;
  };
  competitors: Array<{
    domain: string;
    type: 'direct';
    reason: string;
    metrics: {
      domain: string;
      domainRating: number;
      ahrefsRank: number | null;
      backlinks: number;
      referringDomains: number;
      orgKeywords: number;
      orgTraffic: number;
      orgCost: number | null;
    };
    topPages: Array<{
      url: string;
      traffic: number;
      topKeyword: string | null;
      topKeywordVolume: number | null;
      topKeywordPosition: number | null;
    }>;
    hasBlog: boolean;
    blogUrl: string | null;
  }>;
}

export interface OrganicCompetitorMetricsData {
  source: 'ahrefs' | 'gpt-only';
  competitors: Array<{
    domain: string;
    source: 'ahrefs' | 'gpt';
    reason: string;
    overlapMetrics: { keywordsCommon: number; keywordsCompetitorOnly: number; sharePercent: number } | null;
    metrics: {
      domain: string;
      domainRating: number;
      ahrefsRank: number | null;
      backlinks: number;
      referringDomains: number;
      orgKeywords: number;
      orgTraffic: number;
      orgCost: number | null;
    };
    topPages: Array<{
      url: string;
      traffic: number;
      topKeyword: string | null;
      topKeywordVolume: number | null;
      topKeywordPosition: number | null;
    }>;
    contentPages: Array<{
      url: string;
      traffic: number;
      topKeyword: string | null;
      topKeywordVolume: number | null;
      topKeywordPosition: number | null;
    }>;
    hasBlog: boolean;
    blogUrl: string | null;
  }>;
}

export interface SerpCandidateData {
  domain: string;
  occurrences: number;
  avgPosition: number;
  sampleUrls: string[];
}

export interface ContentGapKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: 'informational' | 'commercial' | 'transactional';
  funnel: 'TOFU' | 'MOFU' | 'BOFU';
  contentType: string;
  opportunity: number;
  competitorCount: number;
  competitorPositions: Array<{ domain: string; position: number }>;
  parentTopic: string;
}

export interface ContentGapData {
  summary: {
    totalGapKeywords: number;
    estimatedMissedTraffic: number;
    avgDifficulty: number;
    competitorsAnalyzed: string[];
  };
  keywords: ContentGapKeyword[];
  emergingOpportunities: Array<{
    keyword: string;
    volume: number;
    difficulty: number;
    competitorPositions: Array<{ domain: string; position: number }>;
    opportunity: number;
  }>;
  topicGroups: Array<{
    topic: string;
    keywords: string[];
    totalVolume: number;
    avgDifficulty: number;
    dominantFunnel: 'TOFU' | 'MOFU' | 'BOFU';
  }>;
}

export interface AuditDetailResponse {
  id: string;
  websiteUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  seedKeywords: string[];
  seedExpansions: string[];
  siteName: string;
  ogImage: string;
  favicon: string;
  pipeline: {
    scrape: ScrapeData | null;
    businessProfile: BusinessProfileData | null;
    deepRead: DeepReadData | null;
    pageSpeed: { mobile: PageSpeedMetricsData; desktop: PageSpeedMetricsData } | null;
    pageSpeedStatus: 'running' | 'background' | 'complete' | 'unavailable' | null;
    keywordResearch: KeywordResearchData | null;
    competitors: CompetitorData | null;
    competitorMetrics: CompetitorMetricsData | null;
    organicCompetitorMetrics: OrganicCompetitorMetricsData | null;
    contentGap: ContentGapData | null;
    serpCandidates: SerpCandidateData[] | null;
  };
  scores: {
    seoScore: number | null;
    geoScore: number | null;
    aeoScore: number | null;
    contentGapCount: number | null;
    estimatedTrafficLoss: number | null;
  };
}

export async function getAuditDetail(auditId: string): Promise<AuditDetailResponse> {
  return apiFetch<AuditDetailResponse>(`/audits/${auditId}`);
}

// ─── Audit List ──────────────────────────────────────────────

export interface AuditSummary {
  id: string;
  websiteUrl: string;
  status: string;
  seoScore: number | null;
  geoScore: number | null;
  aeoScore: number | null;
  contentGapCount: number | null;
  estimatedTrafficLoss: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ListAuditsResponse {
  audits: AuditSummary[];
  page: number;
  limit: number;
}

export async function listAudits(page = 1, limit = 50): Promise<ListAuditsResponse> {
  return apiFetch<ListAuditsResponse>(`/audits?page=${page}&limit=${limit}`);
}

// ─── Create Audit (dashboard) ────────────────────────────────

interface CreateAuditPayload {
  websiteUrl: string;
  businessDescription: string;
  countries: string[];
}

interface CreateAuditResponse {
  auditId: string;
}

export async function createAudit(payload: CreateAuditPayload): Promise<CreateAuditResponse> {
  return apiFetch<CreateAuditResponse>('/audits', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
