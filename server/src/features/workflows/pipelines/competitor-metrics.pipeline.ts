import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

/**
 * Tier 1 pipeline: Competitor Metrics
 * Collects backlink summary + ranked keywords for each competitor via DataForSEO.
 * No LLM needed — pure API aggregation.
 */
@Injectable()
export class CompetitorMetricsPipeline implements Pipeline {
  stepKey = 'competitor-metrics';
  private readonly logger = new Logger(CompetitorMetricsPipeline.name);

  constructor(private readonly dataforseo: DataForSeoService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string) || 'us';
    const language = (context.language as string) || 'en';
    const location = (context.location as string) || 'United States';

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
          const [backlinksSummary, rankedKws] = await Promise.all([
            this.dataforseo.getBacklinksSummary(competitor),
            this.dataforseo.getRankedKeywords(competitor, location, language, 20),
          ]);

          return {
            domain: competitor,
            backlinksSummary,
            rankedKeywords: rankedKws,
            status: 'success' as const,
          };
        } catch (error) {
          this.logger.warn(`Failed to fetch metrics for ${competitor}: ${(error as Error).message}`);
          return {
            domain: competitor,
            backlinksSummary: null,
            rankedKeywords: null,
            status: 'error' as const,
            error: (error as Error).message,
          };
        }
      }),
    );

    // Also fetch the target domain for comparison —
    // business-profile pipeline already ran getBacklinksSummary for this domain;
    // read from context instead of making duplicate API calls.
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
      // Extract backlink metrics from DataForSEO backlinks/summary/live response
      const blRaw = r.backlinksSummary as {
        tasks?: Array<{ result?: Array<{
          backlinks?: number;
          dofollow?: number;
          referring_domains?: number;
          referring_main_domains?: number;
          rank?: number;
          main_domain_rank?: number;
        }> }>;
      } | null;
      const bl = blRaw?.tasks?.[0]?.result?.[0];

      // Extract keywords from DataForSEO ranked_keywords response
      const kwRaw = r.rankedKeywords as {
        tasks?: Array<{ result?: Array<{ items?: Array<{
          keyword_data?: {
            keyword?: string;
            keyword_info?: { search_volume?: number; cpc?: number };
            keyword_properties?: { keyword_difficulty?: number };
          };
          ranked_serp_element?: { serp_item?: { rank_group?: number; url?: string } };
        }> }> }>;
      } | null;
      const kwItems = kwRaw?.tasks?.[0]?.result?.[0]?.items ?? [];
      const topKeywordList = kwItems
        .filter((k) => k.keyword_data?.keyword)
        .map((k) => ({
          keyword: k.keyword_data!.keyword!,
          volume: k.keyword_data?.keyword_info?.search_volume ?? 0,
          difficulty: k.keyword_data?.keyword_properties?.keyword_difficulty ?? 0,
          position: k.ranked_serp_element?.serp_item?.rank_group ?? null,
          url: k.ranked_serp_element?.serp_item?.url ?? '',
        }));

      // Use main_domain_rank / 10 as DR proxy (DFS 0-1000 → 0-100)
      const domainRating = bl?.main_domain_rank ? Math.round(bl.main_domain_rank / 10) : 0;

      return {
        domain: r.domain,
        bucket: 'direct' as const,
        domainRating,
        ahrefsRank: bl?.rank ?? undefined,
        organicKeywords: topKeywordList.length,
        organicTraffic: 0,
        referringDomains: bl?.referring_domains ?? 0,
        backlinks: {
          live: bl?.backlinks ?? 0,
          allTime: bl?.backlinks ?? 0,
          liveRefDomains: bl?.referring_domains ?? 0,
          allTimeRefDomains: bl?.referring_main_domains ?? 0,
        },
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
