import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';

/**
 * V7 Pipeline: Method 02 — Seed Expansion
 * Provides seed keyword data to the managed agent for modifier expansion,
 * question variant generation, and topic clustering.
 *
 * No direct API calls — reuses the scored seedKeywords already produced
 * by the seed-keywords step (which already called getRelatedKeywords +
 * getKeywordSuggestions for the same seeds). The agent applies modifier
 * patterns, question frameworks, and topic clustering against this data.
 *
 * Why no API calls: seed-keywords pipeline fetches getRelatedKeywords +
 * getKeywordSuggestions for the top 20 seeds. Method02 used to re-fetch
 * the same endpoints for the same seeds — 40 duplicate credits per run.
 * Since allowedTools:[] blocks live tools anyway, Claude operates only
 * on pipeline_data in both cases. Passing the structured seedKeywords[]
 * directly is equivalent data with zero duplicate API spend.
 */
@Injectable()
export class Method02SeedExpansionPipeline implements Pipeline {
  stepKey = 'method02-seed-expansion';
  private readonly logger = new Logger(Method02SeedExpansionPipeline.name);

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const seedKwCtx = context['seed-keywords'] as {
      seedKeywords?: Array<{
        keyword: string;
        volume?: number;
        difficulty?: number;
        intent?: string;
        currentPosition?: number;
      }>;
      categories?: string[];
      totalCount?: number;
    } | undefined;

    const seedKeywords = seedKwCtx?.seedKeywords ?? [];
    const categories = seedKwCtx?.categories ?? [];

    this.logger.log(
      `Method 02: passing ${seedKeywords.length} seed keywords to expansion agent (no API calls)`,
    );

    return {
      rawData: {
        seedKeywords,
        categories,
        seedCount: seedKeywords.length,
      },
      metadata: {
        country: (context.country as string) || 'us',
        seedsProcessed: seedKeywords.length,
        apiCallCount: 0,
        source: 'seed-keywords-context',
      },
    };
  }
}

