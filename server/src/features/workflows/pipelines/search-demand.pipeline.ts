import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * Tier 1 pipeline: Search Demand
 * Batch volume + difficulty lookups for seed keywords.
 * No LLM needed — pure API aggregation + scoring.
 */
@Injectable()
export class SearchDemandPipeline implements Pipeline {
  stepKey = 'search-demand';
  private readonly logger = new Logger(SearchDemandPipeline.name);

  constructor(
    private readonly dataforseo: DataForSeoService,
    private readonly ahrefs: AhrefsService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const keywords = (context.seedKeywords as string[]) || [];
    const country = (context.country as string) || 'us';
    const location = (context.location as string) || 'United States';

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
        this.ahrefs.getKeywordDifficulty(batch, country),
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

    return {
      keywords: allResults,
      meta: {
        totalQueried: keywords.length,
        totalWithVolume: allResults.filter((r) => r.volume > 0).length,
        country,
        location,
      },
    };
  }

  private parseVolumeResponse(response: unknown): Map<string, number> {
    const map = new Map<string, number>();
    if (!response || typeof response !== 'object') return map;
    const data = response as Record<string, unknown>;
    if (Array.isArray(data.results)) {
      for (const item of data.results as Array<Record<string, unknown>>) {
        if (item.keyword && typeof item.search_volume === 'number') {
          map.set(String(item.keyword).toLowerCase(), item.search_volume);
        }
      }
    }
    return map;
  }

  private parseDifficultyResponse(response: unknown): Map<string, number> {
    const map = new Map<string, number>();
    if (!response || typeof response !== 'object') return map;
    const data = response as Record<string, unknown>;
    if (Array.isArray(data.keywords)) {
      for (const item of data.keywords as Array<Record<string, unknown>>) {
        if (item.keyword && typeof item.difficulty === 'number') {
          map.set(String(item.keyword).toLowerCase(), item.difficulty);
        }
      }
    }
    return map;
  }
}
