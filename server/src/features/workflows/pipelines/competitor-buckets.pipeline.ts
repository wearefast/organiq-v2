import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';
import { SerperService } from '../../integrations/serper/serper.service';

/**
 * V7 Pipeline: Competitor Buckets
 * Fetches competing domains from DataForSEO Labs and corroborates with Serper search.
 * Returns raw competitor data for agent classification — NO bucketing logic here.
 */
@Injectable()
export class CompetitorBucketsPipeline implements Pipeline {
  stepKey = 'competitor-buckets';
  private readonly logger = new Logger(CompetitorBucketsPipeline.name);

  constructor(
    private readonly dataforseo: DataForSeoService,
    private readonly serper: SerperService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string) || 'us';
    const language = (context.language as string) || 'en';
    const location = (context.location as string) || 'United States';
    const start = Date.now();

    if (!domain) throw new Error('competitor-buckets pipeline requires context.domain');

    // Extract service keywords from business profile for Serper searches
    const businessCtx = context['business-profile'] as {
      primary_services?: string[];
      industry?: string;
      rawData?: { organicKeywords?: unknown };
    } | undefined;
    const services = businessCtx?.primary_services ?? [];
    const industry = businessCtx?.industry ?? '';

    let apiCallCount = 0;

    // 1. Fetch organic competitors from DataForSEO Labs
    this.logger.log(`Competitor buckets: fetching competing domains for ${domain}`);
    const competingDomainsRaw = await this.dataforseo.getCompetitorsDomain(domain, location, language, 20);
    apiCallCount++;

    // Normalize DFS response to match the shape downstream expects
    const dfsData = competingDomainsRaw as {
      tasks?: Array<{ result?: Array<{ items?: Array<{
        domain?: string;
        avg_position?: number;
        intersections?: number;
        full_domain_metrics?: { organic?: { etv?: number; count?: number } };
        competitor_metrics?: { organic?: { etv?: number; count?: number } };
      }> }> }>;
    };
    const dfsItems = dfsData?.tasks?.[0]?.result?.[0]?.items ?? [];
    const competingDomains = {
      competitors: dfsItems.map((item) => ({
        competitor_domain: item.domain ?? '',
        keywords_common: item.intersections ?? 0,
        keywords_competitor: item.competitor_metrics?.organic?.count ?? item.full_domain_metrics?.organic?.count ?? 0,
        keywords_target: 0,
        traffic: item.competitor_metrics?.organic?.etv ?? item.full_domain_metrics?.organic?.etv ?? 0,
        share: 0,
        domain_rating: null,
      })).filter((c) => c.competitor_domain.length > 0),
    };

    // 2. Search for competitors using service keywords (max 3 searches to stay efficient)
    const searchQueries = [
      ...services.slice(0, 2).map((s) => `${s} ${industry}`.trim()),
      industry,
    ].filter(Boolean).slice(0, 3);

    const serperResults: Array<{ query: string; data: unknown }> = [];
    for (const query of searchQueries) {
      try {
        const results = await this.serper.search({ query, country, num: 10 });
        apiCallCount++;
        serperResults.push({ query, data: results });
      } catch (err) {
        this.logger.warn(`Serper search failed for "${query}": ${(err as Error).message}`);
      }
    }

    return {
      rawData: {
        competingDomains,
        serperResults,
        domain,
      },
      metadata: {
        domain,
        country,
        searchQueriesRun: serperResults.length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}
