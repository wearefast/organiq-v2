import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineService } from './pipeline.service';
import { CompetitorMetricsPipeline } from './competitor-metrics.pipeline';
import { SearchDemandPipeline } from './search-demand.pipeline';
import { Method01CompetitorPagesPipeline } from './method01-competitor-pages.pipeline';
import { Method02SeedExpansionPipeline } from './method02-seed-expansion.pipeline';
import { Method03ContentGapPipeline } from './method03-content-gap.pipeline';
import { BusinessProfilePipeline } from './business-profile.pipeline';
import { SeedKeywordsPipeline } from './seed-keywords.pipeline';
import { SerpNicheMapPipeline } from './serp-niche-map.pipeline';
import { CompetitorBucketsPipeline } from './competitor-buckets.pipeline';
import { Phase1BaselinePipeline } from './phase1-baseline.pipeline';
import { ContentBriefPipeline } from './content-brief.pipeline';
import { SiteAuditPipeline } from './site-audit.pipeline';
import { ContentArticlePipeline } from './content-article.pipeline';
import { AiIntelligencePipeline } from './ai-intelligence.pipeline';
import { ConsolidatedKeywordsPipeline } from './consolidated-keywords.pipeline';

// Mock dependencies
const mockAhrefs = {
  getDomainRating: vi.fn().mockResolvedValue(65),
  getBacklinksStats: vi.fn().mockResolvedValue({ total: 1500, dofollow: 900 }),
  getOrganicKeywords: vi.fn().mockResolvedValue({ keywords: [{ keyword: 'test', position: 3 }] }),
  getOrganicPages: vi.fn().mockResolvedValue({ pages: [] }),
  getKeywordDifficulty: vi.fn().mockResolvedValue({ results: [{ keyword: 'seo', difficulty: 45 }] }),
  getRelatedKeywords: vi.fn().mockResolvedValue({ results: [{ keyword: 'seo tools' }] }),
  getCompetingDomains: vi.fn().mockResolvedValue({ competitors: [] }),
  getSerpOverview: vi.fn().mockResolvedValue({ serp: [] }),
};

const mockDataforseo = {
  getKeywordSearchVolume: vi.fn().mockResolvedValue({ results: [{ keyword: 'seo', search_volume: 5400 }] }),
  getKeywordSuggestions: vi.fn().mockResolvedValue({ results: [] }),
};

const mockFirecrawl = {
  scrape: vi.fn().mockResolvedValue({ markdown: 'content', metadata: {} }),
  mapSite: vi.fn().mockResolvedValue({ links: [] }),
  crawl: vi.fn().mockResolvedValue({ data: [] }),
};

const mockPageSpeed = {
  analyze: vi.fn().mockResolvedValue({}),
  getCruxData: vi.fn().mockResolvedValue(null),
};

const mockDataforSeoOnPage = {
  createOnPageTask: vi.fn().mockResolvedValue({ tasks: [] }),
};

const mockSerper = {
  search: vi.fn().mockResolvedValue({ organic: [] }),
};
const mockOpenAi = {
  inferAiBrandMention: vi.fn().mockResolvedValue({ mentioned: false, position: 'absent', mentionContext: null, aiResponse: '' }),
  generateNaturalBrandQueries: vi.fn().mockResolvedValue([
    'best coupon apps in Dubai',
    'Luvin Deals review 2026',
    'Luvin Deals vs competitor',
    'is Luvin Deals good',
    'recommend coupon sites for shopping',
  ]),
  generateImage: vi.fn().mockResolvedValue({ url: 'https://example.com/image.png' }),
};


describe('PipelineService', () => {
  let service: PipelineService;

  beforeEach(() => {
    vi.clearAllMocks();

    const competitorMetrics = new CompetitorMetricsPipeline(mockDataforseo as any);
    const searchDemand = new SearchDemandPipeline(mockDataforseo as any);
    const method01 = new Method01CompetitorPagesPipeline(mockAhrefs as any);
    const method02 = new Method02SeedExpansionPipeline();
    const method03 = new Method03ContentGapPipeline(mockAhrefs as any);
    const businessProfile = new BusinessProfilePipeline(mockFirecrawl as any, mockDataforseo as any);
    const seedKeywords = new SeedKeywordsPipeline(mockDataforseo as any, mockAhrefs as any);
    const serpNicheMap = new SerpNicheMapPipeline(mockAhrefs as any);
    const competitorBuckets = new CompetitorBucketsPipeline(mockDataforseo as any, mockSerper as any);
    const phase1Baseline = new Phase1BaselinePipeline(mockAhrefs as any);
    const contentBrief = new ContentBriefPipeline(mockSerper as any, mockFirecrawl as any);
    const siteAudit = new SiteAuditPipeline(mockFirecrawl as any, mockDataforSeoOnPage as any, mockPageSpeed as any);
    const contentArticle = new ContentArticlePipeline(mockSerper as any);
    const aiIntelligence = new AiIntelligencePipeline(mockFirecrawl as any, mockSerper as any, mockOpenAi as any);
    const consolidatedKeywords = new ConsolidatedKeywordsPipeline();

    service = new PipelineService(
      competitorMetrics, searchDemand, method01, method02, method03, businessProfile,
      seedKeywords, serpNicheMap, competitorBuckets, phase1Baseline, contentBrief, siteAudit,
      contentArticle, aiIntelligence, consolidatedKeywords,
    );
  });

  it('registers all 14 pipelines', () => {
    expect(service.getPipeline('competitor-metrics')).not.toBeNull();
    expect(service.getPipeline('search-demand')).not.toBeNull();
    expect(service.getPipeline('method01-competitor-pages')).not.toBeNull();
    expect(service.getPipeline('method02-seed-expansion')).not.toBeNull();
    expect(service.getPipeline('method03-content-gap-import')).not.toBeNull();
    expect(service.getPipeline('business-profile')).not.toBeNull();
    expect(service.getPipeline('seed-keywords')).not.toBeNull();
    expect(service.getPipeline('serp-niche-map')).not.toBeNull();
    expect(service.getPipeline('competitor-buckets')).not.toBeNull();
    expect(service.getPipeline('phase1-baseline')).not.toBeNull();
    expect(service.getPipeline('content-brief')).not.toBeNull();
    expect(service.getPipeline('site-audit')).not.toBeNull();
    expect(service.getPipeline('content-article')).not.toBeNull();
    expect(service.getPipeline('ai-intelligence')).not.toBeNull();
  });

  it('returns null for unregistered step', () => {
    expect(service.getPipeline('nonexistent')).toBeNull();
  });

  it('throws for unregistered step on execute', async () => {
    await expect(service.execute('nonexistent', {})).rejects.toThrow('No pipeline registered for step');
  });
});

describe('CompetitorMetricsPipeline', () => {
  let pipeline: CompetitorMetricsPipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new CompetitorMetricsPipeline(mockDataforseo as any);
  });

  it('has correct stepKey', () => {
    expect(pipeline.stepKey).toBe('competitor-metrics');
  });

  it('fetches metrics for all competitors', async () => {
    const result = (await pipeline.execute({
      domain: 'example.com',
      country: 'us',
      competitors: ['comp1.com', 'comp2.com'],
    })) as any;

    expect(result.targetDomain.domain).toBe('example.com');
    expect(result.competitors).toHaveLength(2);
    expect(result.competitors[0].status).toBe('success');
    expect(result.competitors[0].domainRating).toBe(65);
    expect(result.meta.totalCompetitors).toBe(2);
    expect(result.meta.successCount).toBe(2);
  });

  it('handles competitor fetch failures gracefully', async () => {
    mockAhrefs.getDomainRating.mockRejectedValueOnce(new Error('API rate limit'));
    mockAhrefs.getBacklinksStats.mockRejectedValueOnce(new Error('API rate limit'));
    mockAhrefs.getOrganicKeywords.mockRejectedValueOnce(new Error('API rate limit'));

    const result = (await pipeline.execute({
      domain: 'example.com',
      competitors: ['failing.com'],
    })) as any;

    expect(result.competitors[0].status).toBe('error');
    expect(result.competitors[0].error).toContain('API rate limit');
    expect(result.meta.successCount).toBe(0);
  });
});

describe('SearchDemandPipeline', () => {
  let pipeline: SearchDemandPipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new SearchDemandPipeline(mockDataforseo as any);
  });

  it('has correct stepKey', () => {
    expect(pipeline.stepKey).toBe('search-demand');
  });

  it('batches keyword lookups and returns results', async () => {
    const result = (await pipeline.execute({
      seedKeywords: ['seo', 'marketing'],
      country: 'us',
      location: 'United States',
    })) as any;

    expect(result.keywords).toHaveLength(2);
    expect(result.meta.totalQueried).toBe(2);
    expect(mockDataforseo.getKeywordSearchVolume).toHaveBeenCalledOnce();
    expect(mockAhrefs.getKeywordDifficulty).toHaveBeenCalledOnce();
  });

  it('uses batch size of 50', async () => {
    const keywords = Array.from({ length: 120 }, (_, i) => `keyword-${i}`);

    const result = (await pipeline.execute({
      seedKeywords: keywords,
      country: 'us',
    })) as any;

    // 120 keywords / 50 batch = 3 batches
    expect(mockDataforseo.getKeywordSearchVolume).toHaveBeenCalledTimes(3);
    expect(mockAhrefs.getKeywordDifficulty).toHaveBeenCalledTimes(3);
    expect(result.keywords).toHaveLength(120);
  });
});

describe('Method03ContentGapPipeline', () => {
  let pipeline: Method03ContentGapPipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new Method03ContentGapPipeline(mockAhrefs as any);
  });

  it('has correct stepKey', () => {
    expect(pipeline.stepKey).toBe('method03-content-gap-import');
  });

  it('finds gap keywords not in target domain', async () => {
    mockAhrefs.getOrganicKeywords
      .mockResolvedValueOnce({ keywords: [{ keyword: 'seo' }, { keyword: 'marketing' }] }) // target
      .mockResolvedValueOnce({ keywords: [{ keyword: 'seo' }, { keyword: 'content strategy' }, { keyword: 'link building' }] }); // competitor

    const result = (await pipeline.execute({
      domain: 'example.com',
      competitors: ['comp.com'],
      country: 'us',
    })) as any;

    // 'seo' is in target, so only 'content strategy' and 'link building' are gaps
    expect(result.gaps).toHaveLength(2);
    expect(result.gaps.map((g: any) => g.keyword)).toContain('content strategy');
    expect(result.gaps.map((g: any) => g.keyword)).toContain('link building');
    expect(result.meta.targetKeywordCount).toBe(2);
  });

  it('deduplicates gap keywords across competitors', async () => {
    mockAhrefs.getOrganicKeywords
      .mockResolvedValueOnce({ keywords: [{ keyword: 'seo' }] }) // target
      .mockResolvedValueOnce({ keywords: [{ keyword: 'link building' }] }) // comp1
      .mockResolvedValueOnce({ keywords: [{ keyword: 'link building' }] }); // comp2

    const result = (await pipeline.execute({
      domain: 'example.com',
      competitors: ['comp1.com', 'comp2.com'],
      country: 'us',
    })) as any;

    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].keyword).toBe('link building');
  });
});
