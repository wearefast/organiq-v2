import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * V7 Pipeline: Method 01 — Competitor Pages
 * Fetches raw top organic pages from each competitor via Ahrefs.
 * Keyword analysis and filtering is handled by the managed agent.
 */
@Injectable()
export class Method01CompetitorPagesPipeline implements Pipeline {
  stepKey = 'method01-competitor-pages';
  private readonly logger = new Logger(Method01CompetitorPagesPipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const bucketsCtx = context['competitor-buckets'] as {
      buckets?: {
        direct?: { competitors?: Array<{ domain: string }> };
        content?: { competitors?: Array<{ domain: string }> };
      };
      rawData?: { competingDomains?: { competitors?: Array<{ competitor_domain?: string }> } };
    } | undefined;

    // Support both old schema (agent output with buckets) and new pipeline schema (rawData)
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

    this.logger.log(`Method 01: fetching top pages from ${competitors.length} competitors`);

    const competitorPagesResults: Array<{ domain: string; data: unknown }> = [];

    for (const competitor of competitors) {
      try {
        const pages = await this.ahrefs.getOrganicPages(competitor, country, 50);
        apiCallCount++;
        competitorPagesResults.push({ domain: competitor, data: pages });
      } catch (err) {
        this.logger.warn(`Failed to fetch pages for ${competitor}: ${(err as Error).message}`);
        competitorPagesResults.push({ domain: competitor, data: null });
      }
    }

    return {
      rawData: {
        competitors,
        competitorPagesResults,
      },
      metadata: {
        country,
        competitorsQueried: competitors.length,
        successful: competitorPagesResults.filter((r) => r.data !== null).length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}

