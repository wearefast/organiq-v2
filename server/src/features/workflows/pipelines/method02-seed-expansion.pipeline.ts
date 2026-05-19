import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

/**
 * Tier 1 pipeline: Method 02 — Seed Expansion
 * Expands seed keywords via related/suggested keyword APIs.
 * No LLM needed — pure API aggregation.
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
    const seedKeywords = (context.seedKeywords as string[]) || [];
    const country = (context.country as string) || 'us';
    const location = (context.location as string) || 'United States';
    const expansionLimit = (context.expansionLimit as number) || 20;

    this.logger.log(`Method 02: Expanding ${seedKeywords.length} seed keywords`);

    const allExpanded: Array<{ keyword: string; source: string; parentSeed: string }> = [];
    const seen = new Set<string>();

    for (const seed of seedKeywords) {
      try {
        // Get related keywords from Ahrefs
        const related = await this.ahrefs.getRelatedKeywords(seed, country, expansionLimit);
        const relatedArray = Array.isArray(related) ? related : ((related as Record<string, unknown>)?.keywords as unknown[]) || [];

        for (const item of relatedArray as Array<Record<string, unknown>>) {
          const kw = String(item.keyword || '').trim().toLowerCase();
          if (kw && !seen.has(kw)) {
            seen.add(kw);
            allExpanded.push({ keyword: kw, source: 'ahrefs_related', parentSeed: seed });
          }
        }

        // Get suggestions from DataForSEO
        const suggestions = await this.dataforseo.getKeywordSuggestions(seed, location, 'en', expansionLimit);
        const suggestionsArray = Array.isArray(suggestions) ? suggestions : ((suggestions as Record<string, unknown>)?.results as unknown[]) || [];

        for (const item of suggestionsArray as Array<Record<string, unknown>>) {
          const kw = String(item.keyword || '').trim().toLowerCase();
          if (kw && !seen.has(kw)) {
            seen.add(kw);
            allExpanded.push({ keyword: kw, source: 'dataforseo_suggestions', parentSeed: seed });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to expand seed "${seed}": ${(error as Error).message}`);
      }
    }

    return {
      keywords: allExpanded,
      meta: {
        seedCount: seedKeywords.length,
        expandedCount: allExpanded.length,
        country,
      },
    };
  }
}
