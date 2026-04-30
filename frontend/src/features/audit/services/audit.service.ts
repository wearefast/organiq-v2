import { apiFetch } from '@/shared/utils/api';

interface SubmitAuditPayload {
  websiteUrl: string;
  name: string;
  email: string;
  businessDescription: string;
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
  step: string;
  progress: number;
  message: string;
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

export interface AuditDetailResponse {
  id: string;
  websiteUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  seedKeywords: string[];
  seedExpansions: string[];
  pipeline: {
    scrape: ScrapeData | null;
    businessProfile: BusinessProfileData | null;
    deepRead: DeepReadData | null;
    pageSpeed: { mobile: PageSpeedMetricsData; desktop: PageSpeedMetricsData } | null;
    keywordResearch: KeywordResearchData | null;
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
