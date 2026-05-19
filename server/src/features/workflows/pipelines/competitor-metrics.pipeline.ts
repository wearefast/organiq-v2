import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * Tier 1 pipeline: Competitor Metrics
 * Collects domain rating, backlinks, organic keywords for each competitor.
 * No LLM needed — pure API aggregation.
 */
@Injectable()
export class CompetitorMetricsPipeline implements Pipeline {
  stepKey = 'competitor-metrics';
  private readonly logger = new Logger(CompetitorMetricsPipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string) || 'us';
    const competitors = (context.competitors as string[]) || [];

    this.logger.log(`Fetching competitor metrics for ${competitors.length} competitors (${domain})`);

    const results = await Promise.all(
      competitors.map(async (competitor) => {
        try {
          const [rating, backlinks, keywords] = await Promise.all([
            this.ahrefs.getDomainRating(competitor),
            this.ahrefs.getBacklinksStats(competitor),
            this.ahrefs.getOrganicKeywords(competitor, country, 20),
          ]);

          return {
            domain: competitor,
            domainRating: rating,
            backlinks,
            topKeywords: keywords,
            status: 'success' as const,
          };
        } catch (error) {
          this.logger.warn(`Failed to fetch metrics for ${competitor}: ${(error as Error).message}`);
          return {
            domain: competitor,
            domainRating: null,
            backlinks: null,
            topKeywords: null,
            status: 'error' as const,
            error: (error as Error).message,
          };
        }
      }),
    );

    // Also fetch the target domain for comparison
    const [targetRating, targetBacklinks] = await Promise.all([
      this.ahrefs.getDomainRating(domain).catch(() => null),
      this.ahrefs.getBacklinksStats(domain).catch(() => null),
    ]);

    return {
      targetDomain: {
        domain,
        domainRating: targetRating,
        backlinks: targetBacklinks,
      },
      competitors: results,
      meta: {
        totalCompetitors: competitors.length,
        successCount: results.filter((r) => r.status === 'success').length,
        country,
      },
    };
  }
}
