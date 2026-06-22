import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * Tier 1 pipeline: Competitor Metrics
 * Collects domain rating, backlinks, organic keywords for each competitor via Ahrefs v3.
 * No LLM needed — pure API aggregation.
 */
@Injectable()
export class CompetitorMetricsPipeline implements Pipeline {
  stepKey = 'competitor-metrics';
  private readonly logger = new Logger(CompetitorMetricsPipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;

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

    // Use Promise.allSettled for resilient per-competitor handling
    const results = await Promise.allSettled(
      competitors.map(async (competitor) => {
        const [drData, blData, kwData] = await Promise.all([
          this.ahrefs.getDomainRating(competitor),
          this.ahrefs.getBacklinksStats(competitor),
          this.ahrefs.getOrganicKeywords(competitor),
        ]);

        return {
          domain: competitor,
          drData,
          blData,
          kwData,
          status: 'success' as const,
        };
      }),
    );

    // Filter out errors, extract successful results
    const successResults = results
      .filter((r): r is PromiseFulfilledResult<{ domain: string; drData: unknown; blData: unknown; kwData: unknown; status: 'success' }> => r.status === 'fulfilled')
      .map((r) => r.value);

    // Read target domain metrics from business-profile context
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

    // Parse Ahrefs v3 responses and build competitor metrics
    const competitorMetrics = successResults.map((r) => {
      // Parse domain rating: { domain_rating: { domain_rating, ahrefs_rank } }
      const drObj = ((r.drData as Record<string, unknown>)?.domain_rating) as Record<string, unknown> | undefined;
      const dr = drObj?.domain_rating != null ? Math.round(Number(drObj.domain_rating)) : 0;
      const rank = drObj?.ahrefs_rank != null ? Number(drObj.ahrefs_rank) : undefined;

      // Parse backlinks stats: { metrics: { live, live_refdomains, all_time, all_time_refdomains } }
      const blMetrics = ((r.blData as Record<string, unknown>)?.metrics) as Record<string, unknown> | undefined;
      const blLive = blMetrics?.live != null ? Number(blMetrics.live) : 0;
      const blRefDomainsLive = blMetrics?.live_refdomains != null ? Number(blMetrics.live_refdomains) : 0;
      const blAllTime = blMetrics?.all_time != null ? Number(blMetrics.all_time) : 0;
      const blRefDomainsAllTime = blMetrics?.all_time_refdomains != null ? Number(blMetrics.all_time_refdomains) : 0;

      // Parse organic keywords: { keywords: [{ keyword, volume, keyword_difficulty, best_position, best_position_url }] }
      const kwList = ((r.kwData as Record<string, unknown>)?.keywords ?? []) as Array<{
        keyword?: string;
        volume?: number;
        keyword_difficulty?: number;
        best_position?: number;
        best_position_url?: string;
      }>;
      const topKeywordList = kwList
        .filter((k) => k.keyword)
        .slice(0, 10)
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
        domainRating: dr,
        ahrefsRank: rank,
        organicKeywords: topKeywordList.length,
        organicTraffic: 0,
        referringDomains: blRefDomainsLive,
        backlinks: {
          live: blLive,
          allTime: blAllTime,
          liveRefDomains: blRefDomainsLive,
          allTimeRefDomains: blRefDomainsAllTime,
        },
        keywords: topKeywordList,
        topPages: topKeywordList.slice(0, 5).map((k) => ({
          url: k.url,
          traffic: k.volume,
          topKeyword: k.keyword,
        })),
        status: 'success' as const,
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
