import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * V7 Pipeline: Method 03 — Content Gap
 * Fetches raw organic keywords for target domain and all competitors.
 * Content gap identification and categorization is handled by the managed agent.
 */
@Injectable()
export class Method03ContentGapPipeline implements Pipeline {
  stepKey = 'method03-content-gap-import';
  private readonly logger = new Logger(Method03ContentGapPipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;

    // This step is an import processor for externally-imported keyword data
    // (Ahrefs Content Gap exports, GSC exports, manual CSVs).
    // If no import data is present in context, skip all API calls immediately.
    // The agent prompt handles empty imports gracefully with an empty result schema.
    const importedKeywords = context['imported-keywords'];
    if (!importedKeywords || (Array.isArray(importedKeywords) && importedKeywords.length === 0)) {
      this.logger.log('Method 03: no imported keywords in context — skipping API calls');
      return {
        importedKeywords: [],
        importStats: {
          totalImported: 0,
          afterCleaning: 0,
          afterDedup: 0,
          newUnique: 0,
          duplicatesRemoved: 0,
          enriched: 0,
        },
        bySource: [],
        topicClusters: [],
        summary: {
          totalNewKeywords: 0,
          totalVolume: 0,
          avgDifficulty: 0,
          avgOpportunityScore: 0,
          topSource: '',
          recommendation: 'No keywords imported. This step is skipped when no external keyword data has been imported.',
        },
        skipped: true,
      };
    }

    const bucketsCtx = context['competitor-buckets'] as {
      buckets?: {
        direct?: { competitors?: Array<{ domain: string }> };
        content?: { competitors?: Array<{ domain: string }> };
      };
      rawData?: { competingDomains?: { competitors?: Array<{ competitor_domain?: string }> } };
    } | undefined;

    // Support both old agent schema and new pipeline schema
    let competitors: string[] = [];
    if (bucketsCtx?.buckets) {
      competitors = [
        ...(bucketsCtx.buckets.direct?.competitors ?? []),
        ...(bucketsCtx.buckets.content?.competitors ?? []),
      ].map((c) => c.domain).filter(Boolean);
    } else if (bucketsCtx?.rawData?.competingDomains) {
      const cd = bucketsCtx.rawData.competingDomains as { competitors?: Array<{ competitor_domain?: string }> };
      competitors = (cd.competitors ?? []).map((c) => c.competitor_domain ?? '').filter(Boolean);
    }

    const country = (context.country as string) || 'us';
    const start = Date.now();
    let apiCallCount = 0;

    this.logger.log(`Method 03: fetching keywords for ${domain} + ${competitors.length} competitors`);

    // Target domain keywords (up to 500 for gap analysis)
    const targetKeywords = await this.ahrefs.getOrganicKeywords(domain, country, 500);
    apiCallCount++;

    // Competitor keywords (up to 200 each)
    const competitorKeywordsResults: Array<{ domain: string; data: unknown }> = [];
    for (const competitor of competitors) {
      try {
        const kwData = await this.ahrefs.getOrganicKeywords(competitor, country, 200);
        apiCallCount++;
        competitorKeywordsResults.push({ domain: competitor, data: kwData });
      } catch (err) {
        this.logger.warn(`Failed to fetch keywords for ${competitor}: ${(err as Error).message}`);
        competitorKeywordsResults.push({ domain: competitor, data: null });
      }
    }

    return {
      rawData: {
        domain,
        targetKeywords,
        competitors,
        competitorKeywordsResults,
      },
      metadata: {
        domain,
        country,
        competitorsQueried: competitors.length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}
