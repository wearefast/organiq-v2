import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineService } from './pipeline.service';
import { CompetitorMetricsPipeline } from './competitor-metrics.pipeline';
import { SearchDemandPipeline } from './search-demand.pipeline';
import { Method01CompetitorPagesPipeline } from './method01-competitor-pages.pipeline';
import { Method02SeedExpansionPipeline } from './method02-seed-expansion.pipeline';
import { Method03ContentGapPipeline } from './method03-content-gap.pipeline';

// Mock dependencies
const mockAhrefs = {
  getDomainRating: vi.fn().mockResolvedValue(65),
  getBacklinksStats: vi.fn().mockResolvedValue({ total: 1500, dofollow: 900 }),
  getOrganicKeywords: vi.fn().mockResolvedValue({ keywords: [{ keyword: 'test', position: 3 }] }),
  getKeywordDifficulty: vi.fn().mockResolvedValue({ results: [{ keyword: 'seo', difficulty: 45 }] }),
  getRelatedKeywords: vi.fn().mockResolvedValue({ results: [{ keyword: 'seo tools' }] }),
  getKeywordSuggestions: vi.fn().mockResolvedValue({ results: [{ keyword: 'best seo' }] }),
};

const mockDataforseo = {
  getKeywordSearchVolume: vi.fn().mockResolvedValue({ results: [{ keyword: 'seo', search_volume: 5400 }] }),
};

describe('PipelineService', () => {
  let service: PipelineService;

  beforeEach(() => {
    vi.clearAllMocks();

    const competitorMetrics = new CompetitorMetricsPipeline(mockAhrefs as any);
    const searchDemand = new SearchDemandPipeline(mockDataforseo as any, mockAhrefs as any);
    const method01 = new Method01CompetitorPagesPipeline(mockAhrefs as any);
    const method02 = new Method02SeedExpansionPipeline(mockAhrefs as any, mockDataforseo as any);
    const method03 = new Method03ContentGapPipeline(mockAhrefs as any);

    service = new PipelineService(competitorMetrics, searchDemand, method01, method02, method03);
  });

  it('registers all 5 pipelines', () => {
    expect(service.getPipeline('competitor-metrics')).not.toBeNull();
    expect(service.getPipeline('search-demand')).not.toBeNull();
    expect(service.getPipeline('method01-competitor-pages')).not.toBeNull();
    expect(service.getPipeline('method02-seed-expansion')).not.toBeNull();
    expect(service.getPipeline('method03-content-gap-import')).not.toBeNull();
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
    pipeline = new CompetitorMetricsPipeline(mockAhrefs as any);
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
    pipeline = new SearchDemandPipeline(mockDataforseo as any, mockAhrefs as any);
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
