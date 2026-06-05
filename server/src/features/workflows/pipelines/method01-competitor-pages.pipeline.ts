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

    // competitor-metrics step already fetched getOrganicKeywords(competitor, country, 20) for each
    // competitor. Read keyword data from context to avoid duplicate API calls and give Claude
    // actual keyword strings for gap analysis (pipeline-only context stores the full pipeline output).
    const cmCtx = context['competitor-metrics'] as {
      competitorMetrics?: Array<{
        domain: string;
        keywords?: Array<{ keyword: string; volume: number; difficulty: number; position: number | null; url: string }>;
      }>;
    } | undefined;
    const competitorKeywordsMap = new Map<string, Array<{ keyword: string; volume: number; difficulty: number; position: number | null; url: string }>>();
    for (const cm of (cmCtx?.competitorMetrics ?? [])) {
      if (cm.domain && cm.keywords) {
        competitorKeywordsMap.set(cm.domain, cm.keywords);
      }
    }

    const competitorPagesResults: Array<{ domain: string; pages: unknown; keywords: unknown }> = [];

    for (const competitor of competitors) {
      try {
        const pages = await this.ahrefs.getOrganicPages(competitor, country, 50);
        apiCallCount++;
        competitorPagesResults.push({
          domain: competitor,
          pages,
          // Include competitor keywords from context (already fetched by competitor-metrics)
          keywords: competitorKeywordsMap.get(competitor) ?? [],
        });
      } catch (err) {
        this.logger.warn(`Failed to fetch pages for ${competitor}: ${(err as Error).message}`);
        competitorPagesResults.push({
          domain: competitor,
          pages: null,
          keywords: competitorKeywordsMap.get(competitor) ?? [],
        });
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
        successful: competitorPagesResults.filter((r) => r.pages !== null).length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}

