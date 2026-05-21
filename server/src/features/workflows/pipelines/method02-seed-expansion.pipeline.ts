import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

/**
 * V7 Pipeline: Method 02 — Seed Expansion
 * Fetches raw related/suggested keywords for each seed via Ahrefs + DataForSEO.
 * Grouping, dedup, and analysis is handled by the managed agent.
 */
@Injectable()
export class Method02SeedExpansionPipeline implements Pipeline {
  stepKey = 'method02-seed-expansion';
  private readonly logger = new Logger(Method02SeedExpansionPipeline.name);

  constructor(
    private readonly ahrefs: AhrefsService,
    private readonly dataforseo: DataForSeoService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const seedKwCtx = context['seed-keywords'] as {
      seedKeywords?: Array<{ keyword: string }>;
      rawData?: { seedTerms?: string[]; organicKeywords?: { keywords?: Array<{ keyword: string }> } };
    } | undefined;

    // Support both old agent schema and new pipeline schema
    let seedKeywords: string[] = [];
    if (seedKwCtx?.seedKeywords) {
      seedKeywords = seedKwCtx.seedKeywords.map((k) => k.keyword).filter(Boolean);
    } else if (seedKwCtx?.rawData?.seedTerms) {
      seedKeywords = seedKwCtx.rawData.seedTerms.filter(Boolean);
    } else if (seedKwCtx?.rawData?.organicKeywords) {
      const kwData = seedKwCtx.rawData.organicKeywords as { keywords?: Array<{ keyword: string }> };
      seedKeywords = (kwData.keywords ?? []).map((k) => k.keyword).filter(Boolean).slice(0, 20);
    }

    const country = (context.country as string) || 'us';
    const location = (context.location as string) || 'United States';
    const limit = 20;
    const start = Date.now();
    let apiCallCount = 0;

    this.logger.log(`Method 02: expanding ${seedKeywords.length} seed keywords`);

    const relatedResults: Array<{ seed: string; data: unknown }> = [];
    const suggestionsResults: Array<{ seed: string; data: unknown }> = [];

    for (const seed of seedKeywords) {
      try {
        const [related, suggestions] = await Promise.all([
          this.ahrefs.getRelatedKeywords(seed, country, limit),
          this.dataforseo.getKeywordSuggestions(seed, location, 'en', limit),
        ]);
        apiCallCount += 2;
        relatedResults.push({ seed, data: related });
        suggestionsResults.push({ seed, data: suggestions });
      } catch (err) {
        this.logger.warn(`Expansion failed for "${seed}": ${(err as Error).message}`);
      }
    }

    return {
      rawData: {
        seedKeywords,
        relatedResults,
        suggestionsResults,
      },
      metadata: {
        country,
        seedsProcessed: seedKeywords.length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}

