import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * V7 Pipeline: SERP Niche Map
 * Calls ahrefs_serp_overview for each seed keyword to map the competitive landscape.
 * Returns raw SERP data for agent classification — NO analysis logic here.
 *
 * Rate limit strategy: 1.1s delay between calls (stays under 60 req/min Ahrefs limit).
 * IMPORTANT: Must NOT run concurrently with seed-keywords pipeline (same Ahrefs key).
 * Dependency graph already prevents this (serp-niche-map depends on seed-keywords).
 */
@Injectable()
export class SerpNicheMapPipeline implements Pipeline {
  stepKey = 'serp-niche-map';
  private readonly logger = new Logger(SerpNicheMapPipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const country = (context.country as string) || 'us';
    const start = Date.now();

    // Extract seed keywords from prior step output
    const seedCtx = context['seed-keywords'] as {
      seedKeywords?: Array<{ keyword: string }>;
      rawData?: { organicKeywords?: { keywords?: Array<{ keyword: string }> }; seedTerms?: string[] };
    } | undefined;

    // Support both old schema (seedKeywords[]) and new pipeline schema (rawData.seedTerms)
    let seedKeywords: string[] = [];
    if (seedCtx?.seedKeywords) {
      seedKeywords = seedCtx.seedKeywords.map((k) => k.keyword).filter(Boolean);
    } else if (seedCtx?.rawData?.seedTerms) {
      seedKeywords = seedCtx.rawData.seedTerms.filter(Boolean);
    } else if (seedCtx?.rawData?.organicKeywords) {
      const kwData = seedCtx.rawData.organicKeywords as { keywords?: Array<{ keyword: string }> };
      seedKeywords = (kwData.keywords ?? []).map((k) => k.keyword).filter(Boolean);
    }

    // Cap at 20: niche segment quality does not improve meaningfully past 20 well-chosen
    // seeds. Seeds beyond 20 are typically long-tail variants of already-represented intents.
    // Saves 30 Ahrefs SERP credits and ~33s wall time per workflow run.
    const keywordsToProcess = seedKeywords.slice(0, 20);
    this.logger.log(`SERP niche map: processing ${keywordsToProcess.length} keywords`);

    const serpResults: Array<{ keyword: string; data: unknown }> = [];
    let apiCallCount = 0;

    for (const keyword of keywordsToProcess) {
      try {
        const serpData = await this.ahrefs.getSerpOverview(keyword, country);
        apiCallCount++;
        serpResults.push({ keyword, data: serpData });
      } catch (err) {
        this.logger.warn(`SERP overview failed for "${keyword}": ${(err as Error).message}`);
        serpResults.push({ keyword, data: null });
      }

      // 1.1s delay between calls — stays safely under 60 req/min
      await sleep(1100);
    }

    return {
      rawData: {
        serpResults,
        keywordsProcessed: keywordsToProcess,
      },
      metadata: {
        country,
        keywordsQueried: keywordsToProcess.length,
        successful: serpResults.filter((r) => r.data !== null).length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}
