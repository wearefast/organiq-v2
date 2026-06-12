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

    // Also fetch the target domain for comparison —
    // business-profile pipeline already ran getDomainRating + getBacklinksStats for this domain;
    // read from context instead of making duplicate Ahrefs calls.
    // context['business-profile'] is the Claude agent output whose top-level schema has
    // `domain_authority: { domain_rating, ahrefs_rank, referring_domains, backlinks, backlinks_all_time }`.
    const bpCtx = context['business-profile'] as {
      domain_authority?: {
        domain_rating?: number | null;
        ahrefs_rank?: number | null;
        referring_domains?: number | null;
        backlinks?: number | null;
        backlinks_all_time?: number | null;
      } | null;
    } | undefined;
    const targetDomainRating = bpCtx?.domain_authority?.domain_rating ?? 0;
    const targetAhrefsRank = bpCtx?.domain_authority?.ahrefs_rank ?? undefined;
    const targetReferringDomains = bpCtx?.domain_authority?.referring_domains ?? 0;
    const targetBacklinksLive = bpCtx?.domain_authority?.backlinks ?? 0;
    const targetBacklinksAllTime = bpCtx?.domain_authority?.backlinks_all_time ?? 0;

    // Align output with the competitorMetrics agent definition schema
    const competitorMetrics = results.map((r) => {
      // Extract top organic keywords — the raw Ahrefs response is { keywords: [{keyword, volume, keyword_difficulty, best_position, ...}] }
      const rawKws = r.topKeywords as {
        keywords?: Array<{
          keyword?: string;
          volume?: number;
          keyword_difficulty?: number;
          best_position?: number;
          best_position_url?: string;
        }>;
      } | null;
      const topKeywordList = (rawKws?.keywords ?? [])
        .filter((k) => k.keyword)
        .map((k) => ({
          keyword: k.keyword!,
          volume: k.volume ?? 0,
          difficulty: k.keyword_difficulty ?? 0,
          position: k.best_position ?? null,
          url: k.best_position_url ?? '',
        }));

      return {
        domain: r.domain,
        bucket: 'direct' as const,
        // Ahrefs v3 /site-explorer/domain-rating returns { domain_rating: { domain_rating: number, ahrefs_rank: number } }
        domainRating: (r.domainRating as { domain_rating?: { domain_rating?: number } } | null)?.domain_rating?.domain_rating ?? 0,
        ahrefsRank: (r.domainRating as { domain_rating?: { ahrefs_rank?: number } } | null)?.domain_rating?.ahrefs_rank ?? undefined,
        organicKeywords: topKeywordList.length,
        organicTraffic: 0,
        // Ahrefs v3 /site-explorer/backlinks-stats returns { metrics: { live, all_time, live_refdomains, ... } }
        referringDomains:
          (r.backlinks as { metrics?: { live_refdomains?: number } } | null)?.metrics?.live_refdomains ?? 0,
        backlinks: {
          live: (r.backlinks as { metrics?: { live?: number } } | null)?.metrics?.live ?? 0,
          allTime: (r.backlinks as { metrics?: { all_time?: number } } | null)?.metrics?.all_time ?? 0,
          liveRefDomains: (r.backlinks as { metrics?: { live_refdomains?: number } } | null)?.metrics?.live_refdomains ?? 0,
          allTimeRefDomains: (r.backlinks as { metrics?: { all_time_refdomains?: number } } | null)?.metrics?.all_time_refdomains ?? 0,
        },
        // Preserve the actual keyword list so downstream steps (method01) can use it for gap analysis
        keywords: topKeywordList,
        topPages: topKeywordList.slice(0, 5).map((k) => ({
          url: k.url,
          traffic: k.volume,
          topKeyword: k.keyword,
        })),
        status: r.status,
        error: (r as { error?: string }).error,
      };
    });

    const avgCompetitorDR =
      competitorMetrics.length > 0
        ? Math.round(competitorMetrics.reduce((s, c) => s + c.domainRating, 0) / competitorMetrics.length)
        : 0;

    return {
      targetMetrics: {
        domain,
        domainRating: targetDomainRating,
        ahrefsRank: targetAhrefsRank,
        organicKeywords: 0,
        organicTraffic: 0,
        referringDomains: targetReferringDomains,
        backlinks: { live: targetBacklinksLive, allTime: targetBacklinksAllTime, liveRefDomains: targetReferringDomains, allTimeRefDomains: 0 },
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
