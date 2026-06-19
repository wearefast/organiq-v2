import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * Tier 1 pipeline: Competitor Metrics
 * Collects DR, backlinks, referring domains, and top keywords for each competitor via Ahrefs.
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

    this.logger.log(`Fetching Ahrefs competitor metrics for ${competitors.length} competitors (${domain})`);

    const results = await Promise.all(
      competitors.map(async (competitor) => {
        // Use allSettled so a backlinks failure does NOT discard keyword data and vice versa
        const [drResult, blResult, kwResult] = await Promise.allSettled([
          this.ahrefs.getDomainRating(competitor),
          this.ahrefs.getBacklinksStats(competitor),
          this.ahrefs.getOrganicKeywords(competitor, country, 20),
        ]);

        if (drResult.status === 'rejected' && blResult.status === 'rejected' && kwResult.status === 'rejected') {
          this.logger.warn(`All Ahrefs calls failed for ${competitor}: ${(drResult.reason as Error).message}`);
          return { domain: competitor, status: 'error' as const, error: (drResult.reason as Error).message };
        }

        // Ahrefs v3 domain-rating: { domainRating: number, ahrefsRank: number }
        const dr = drResult.status === 'fulfilled' ? (drResult.value as Record<string, unknown>) : {};
        const domainRating = Number(dr?.domainRating ?? 0);
        const ahrefsRank = dr?.ahrefsRank ? Number(dr.ahrefsRank) : undefined;

        // Ahrefs v3 backlinks-stats: { live: number, liveRefDomains: number, allTime: number, allTimeRefDomains: number }
        const bl = blResult.status === 'fulfilled' ? (blResult.value as Record<string, unknown>) : {};
        const blLive = Number(bl?.live ?? 0);
        const blAllTime = Number(bl?.allTime ?? blLive);
        const refDomainsLive = Number(bl?.liveRefDomains ?? 0);
        const refDomainsAllTime = Number(bl?.allTimeRefDomains ?? refDomainsLive);

        // Ahrefs v3 organic-keywords: { keywords: { items: [{ keyword, volume, keyword_difficulty, best_position, best_position_url }] } }
        const kwRaw = kwResult.status === 'fulfilled' ? (kwResult.value as Record<string, unknown>) : {};
        const kwItems = ((kwRaw?.keywords as Record<string, unknown>)?.items as Array<Record<string, unknown>>) ?? [];
        const topKeywordList = kwItems
          .filter((k) => k.keyword)
          .map((k) => ({
            keyword: String(k.keyword),
            volume: Number(k.volume ?? 0),
            difficulty: Number(k.keyword_difficulty ?? 0),
            position: k.best_position ? Number(k.best_position) : null,
            url: String(k.best_position_url ?? ''),
          }));

        return {
          domain: competitor,
          bucket: 'direct' as const,
          domainRating,
          ahrefsRank,
          organicKeywords: topKeywordList.length,
          organicTraffic: 0,
          referringDomains: refDomainsLive,
          backlinks: {
            live: blLive,
            allTime: blAllTime,
            liveRefDomains: refDomainsLive,
            allTimeRefDomains: refDomainsAllTime,
          },
          keywords: topKeywordList,
          topPages: topKeywordList.slice(0, 5).map((k) => ({
            url: k.url,
            traffic: k.volume,
            topKeyword: k.keyword,
          })),
          status: 'success' as const,
        };
      }),
    );

    // Target domain metrics — read from business-profile agent output (no duplicate Ahrefs call)
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

    const competitorMetrics = results.filter((r) => r.status !== 'error') as Array<{
      domain: string; bucket: string; domainRating: number; ahrefsRank?: number;
      organicKeywords: number; organicTraffic: number; referringDomains: number;
      backlinks: { live: number; allTime: number; liveRefDomains: number; allTimeRefDomains: number };
      keywords: Array<{ keyword: string; volume: number; difficulty: number; position: number | null; url: string }>;
      topPages: Array<{ url: string; traffic: number; topKeyword: string }>;
      status: 'success';
    }>;

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
