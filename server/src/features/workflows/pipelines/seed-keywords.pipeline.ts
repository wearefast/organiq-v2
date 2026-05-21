import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * V7 Pipeline: Seed Keywords
 * Fetches seed keywords via Ahrefs organic keywords + related terms + DataForSEO suggestions.
 * Returns raw API responses for agent analysis — NO analysis logic here.
 *
 * Rate limit strategy: Ahrefs 60 req/min. Batch seeds in groups of 10 with 1s delay.
 */
@Injectable()
export class SeedKeywordsPipeline implements Pipeline {
  stepKey = 'seed-keywords';
  private readonly logger = new Logger(SeedKeywordsPipeline.name);

  constructor(
    private readonly ahrefs: AhrefsService,
    private readonly dataforseo: DataForSeoService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string) || 'us';
    const location = (context.location as string) || 'United States';
    const start = Date.now();

    if (!domain) throw new Error('seed-keywords pipeline requires context.domain');

    let apiCallCount = 0;

    // Step 1: Get domain's existing organic keywords (top 50 by traffic)
    this.logger.log(`Seed keywords: fetching organic keywords for ${domain}`);
    const organicKeywords = await this.ahrefs.getOrganicKeywords(domain, country, 50);
    apiCallCount++;

    // Step 2: Extract seed terms from organic keywords
    const organicData = organicKeywords as { keywords?: Array<{ keyword: string }> };
    const seedTerms: string[] = (organicData?.keywords ?? [])
      .map((k) => k.keyword)
      .filter(Boolean)
      .slice(0, 20);

    // Step 3: For each seed, get related terms + DataForSEO suggestions
    // Batch in groups of 10 with 1s delay between batches (Ahrefs 60 req/min limit)
    const BATCH_SIZE = 10;
    const relatedTermsResults: Array<{ seed: string; data: unknown }> = [];
    const suggestionsResults: Array<{ seed: string; data: unknown }> = [];

    for (let i = 0; i < seedTerms.length; i += BATCH_SIZE) {
      const batch = seedTerms.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (seed) => {
          try {
            const [related, suggestions] = await Promise.all([
              this.ahrefs.getRelatedKeywords(seed, country, 20),
              this.dataforseo.getKeywordSuggestions(seed, location, 'en', 20),
            ]);
            apiCallCount += 2;
            relatedTermsResults.push({ seed, data: related });
            suggestionsResults.push({ seed, data: suggestions });
          } catch (err) {
            this.logger.warn(`Seed expansion failed for "${seed}": ${(err as Error).message}`);
          }
        }),
      );

      // Throttle between batches
      if (i + BATCH_SIZE < seedTerms.length) {
        await sleep(1000);
      }
    }

    return {
      rawData: {
        organicKeywords,
        seedTerms,
        relatedTerms: relatedTermsResults,
        suggestions: suggestionsResults,
      },
      metadata: {
        domain,
        country,
        seedTermsDiscovered: seedTerms.length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}
