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

    // competitor-buckets output shape: { buckets: { direct: { competitors: [{domain, name, ...}] }, content: {...}, ... } }
    const bucketsCtx = context['competitor-buckets'] as {
      buckets?: {
        direct?: { competitors?: Array<{ domain: string }> };
        content?: { competitors?: Array<{ domain: string }> };
        indirect?: { competitors?: Array<{ domain: string }> };
      };
    } | undefined;
    const competitors = [
      ...(bucketsCtx?.buckets?.direct?.competitors ?? []),
      ...(bucketsCtx?.buckets?.content?.competitors ?? []),
    ]
      .map((c) => c.domain)
      .filter(Boolean) as string[];

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

    // Align output with the competitorMetrics agent definition schema
    const competitorMetrics = results.map((r) => ({
      domain: r.domain,
      bucket: 'direct' as const,
      domainRating: (r.domainRating as { domainRating?: number } | null)?.domainRating ?? 0,
      organicKeywords: Array.isArray(r.topKeywords) ? r.topKeywords.length : 0,
      organicTraffic: 0,
      referringDomains:
        (r.backlinks as { liveRefDomains?: number } | null)?.liveRefDomains ?? 0,
      backlinks: r.backlinks ?? { live: 0, allTime: 0, liveRefDomains: 0, allTimeRefDomains: 0 },
      topPages: Array.isArray(r.topKeywords)
        ? (r.topKeywords as Array<{ url?: string; traffic?: number; keyword?: string }>).slice(0, 5).map((k) => ({
            url: k.url ?? '',
            traffic: k.traffic ?? 0,
            keywords: 1,
          }))
        : [],
      status: r.status,
      error: (r as { error?: string }).error,
    }));

    const targetDomainRating = (targetRating as { domainRating?: number } | null)?.domainRating ?? 0;
    const avgCompetitorDR =
      competitorMetrics.length > 0
        ? Math.round(competitorMetrics.reduce((s, c) => s + c.domainRating, 0) / competitorMetrics.length)
        : 0;

    return {
      targetMetrics: {
        domain,
        domainRating: targetDomainRating,
        organicKeywords: 0,
        organicTraffic: 0,
        referringDomains:
          (targetBacklinks as { liveRefDomains?: number } | null)?.liveRefDomains ?? 0,
        backlinks: targetBacklinks ?? { live: 0, allTime: 0, liveRefDomains: 0, allTimeRefDomains: 0 },
        topPages: [],
      },
      competitorMetrics,
      benchmarks: {
        avgDomainRating: avgCompetitorDR,
        avgOrganicKeywords: 0,
        avgReferringDomains:
          competitorMetrics.length > 0
            ? Math.round(competitorMetrics.reduce((s, c) => s + c.referringDomains, 0) / competitorMetrics.length)
            : 0,
        medianOrganicTraffic: 0,
      },
      gaps: [
        {
          metric: 'domainRating',
          targetValue: targetDomainRating,
          benchmarkValue: avgCompetitorDR,
          gap: avgCompetitorDR - targetDomainRating,
          priority: avgCompetitorDR - targetDomainRating > 20 ? 'high' : 'medium',
          closingStrategy: 'Link building campaign targeting competitor backlink sources',
        },
      ].filter((g) => g.gap > 0),
      quickWins: [],
      summary: `Analysed ${competitorMetrics.length} competitors against ${domain}. Target DR: ${targetDomainRating}. Competitor avg DR: ${avgCompetitorDR}.`,
    };
  }
}
