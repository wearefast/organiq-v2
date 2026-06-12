import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

/**
 * Tier 1 pipeline: Search Demand
 * Batch volume + difficulty lookups for seed keywords via DataForSEO.
 * No LLM needed — pure API aggregation + scoring.
 */
@Injectable()
export class SearchDemandPipeline implements Pipeline {
  stepKey = 'search-demand';
  private readonly logger = new Logger(SearchDemandPipeline.name);

  constructor(
    private readonly dataforseo: DataForSeoService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    // Context stores prior step output under its step key, not as flat properties.
    // seed-keywords output shape: { seedKeywords: [{keyword, volume, difficulty, ...}] }
    const seedKwCtx = context['seed-keywords'] as { seedKeywords?: Array<{ keyword: string }> } | undefined;
    const keywords = seedKwCtx?.seedKeywords?.map((kw) => kw.keyword) ?? [];
    const location = (context.location as string) || 'United States';
    const language = (context.language as string) || 'en';

    this.logger.log(`Fetching search demand for ${keywords.length} keywords`);

    // Batch in chunks of 50
    const BATCH_SIZE = 50;
    const allResults: Array<{
      keyword: string;
      volume: number;
      difficulty: number;
      cpc: number;
    }> = [];

    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, i + BATCH_SIZE);

      const [volumes, difficulties] = await Promise.all([
        this.dataforseo.getKeywordSearchVolume(batch, location),
        this.dataforseo.getBulkKeywordDifficulty(batch, location, language),
      ]);

      const volumeMap = this.parseVolumeResponse(volumes);
      const difficultyMap = this.parseDifficultyResponse(difficulties);

      for (const kw of batch) {
        const kwLower = kw.toLowerCase();
        allResults.push({
          keyword: kw,
          volume: volumeMap.get(kwLower) ?? 0,
          difficulty: difficultyMap.get(kwLower) ?? 0,
          cpc: 0, // CPC comes from volume response if available
        });
      }
    }

    // Calculate aggregate stats
    const totalAddressableVolume = allResults.reduce((sum, r) => sum + r.volume, 0);
    const withVolume = allResults.filter((r) => r.volume > 0);
    const realisticTargetVolume = Math.round(totalAddressableVolume * 0.1);

    // Build enrichedKeywords matching the agent definition output schema
    const enrichedKeywords = allResults.map((r) => ({
      keyword: r.keyword,
      category: 'general',
      intent: 'informational' as const,
      metrics: {
        searchVolume: r.volume,
        keywordDifficulty: r.difficulty,
        cpc: r.cpc,
        competition: r.difficulty > 60 ? 'high' : r.difficulty > 30 ? 'medium' : 'low',
        trend: 'stable',
      },
      opportunityScore:
        r.volume > 0
          ? parseFloat(
              (
                (Math.min(r.volume, 10000) / 10000) * 0.4 +
                ((100 - r.difficulty) / 100) * 0.4 +
                0.5 * 0.2
              ).toFixed(3),
            )
          : 0,
    }));

    const highOpportunity = enrichedKeywords
      .filter((k) => k.metrics.searchVolume > 0)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 20)
      .map((k) => ({
        keyword: k.keyword,
        volume: k.metrics.searchVolume,
        difficulty: k.metrics.keywordDifficulty,
        opportunityScore: k.opportunityScore,
        rationale: `Volume: ${k.metrics.searchVolume.toLocaleString()}, KD: ${k.metrics.keywordDifficulty}`,
      }));

    return {
      enrichedKeywords,
      demandByCategory: [
        {
          category: 'general',
          totalVolume: totalAddressableVolume,
          avgDifficulty:
            allResults.length > 0
              ? Math.round(allResults.reduce((s, r) => s + r.difficulty, 0) / allResults.length)
              : 0,
          keywordCount: allResults.length,
          topKeyword: allResults.sort((a, b) => b.volume - a.volume)[0]?.keyword ?? '',
        },
      ],
      demandByIntent: {
        informational: { volume: totalAddressableVolume, count: allResults.length, avgDifficulty: 0 },
        navigational: { volume: 0, count: 0, avgDifficulty: 0 },
        commercial: { volume: 0, count: 0, avgDifficulty: 0 },
        transactional: { volume: 0, count: 0, avgDifficulty: 0 },
      },
      highOpportunity,
      totalAddressableVolume,
      realisticTargetVolume,
      summary: `Analysed ${allResults.length} keywords. Total addressable volume: ${totalAddressableVolume.toLocaleString()}. ${withVolume.length} keywords have volume data. Top opportunity score: ${enrichedKeywords[0]?.opportunityScore ?? 0}.`,
    };
  }

  private parseVolumeResponse(response: unknown): Map<string, number> {
    const map = new Map<string, number>();
    if (!response || typeof response !== 'object') return map;
    const data = response as Record<string, unknown>;
    // DataForSEO returns { tasks: [...] }
    if (Array.isArray(data.tasks)) {
      const tasks = data.tasks as Array<Record<string, unknown>>;
      for (const task of tasks) {
        const results = task.result as Array<Record<string, unknown>>;
        if (Array.isArray(results)) {
          for (const item of results) {
            const keyword = item.keyword as string;
            const volume = item.search_volume as number;
            if (keyword && typeof volume === 'number') {
              map.set(keyword.toLowerCase(), volume);
            }
          }
        }
      }
    }
    return map;
  }

  private parseDifficultyResponse(response: unknown): Map<string, number> {
    const map = new Map<string, number>();
    if (!response || typeof response !== 'object') return map;
    const data = response as { tasks?: Array<{ result?: Array<{ items?: Array<{ keyword?: string; keyword_difficulty?: number }> }> }> };
    const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    for (const item of items) {
      if (item.keyword && typeof item.keyword_difficulty === 'number') {
        map.set(item.keyword.toLowerCase(), item.keyword_difficulty);
      }
    }
    return map;
  }
}
