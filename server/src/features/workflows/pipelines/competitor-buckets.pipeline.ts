import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';
import { SerperService } from '../../integrations/serper/serper.service';

/**
 * V7 Pipeline: Competitor Buckets
 * Fetches competing domains from Ahrefs and corroborates with Serper search.
 * Returns raw competitor data for agent classification — NO bucketing logic here.
 */
@Injectable()
export class CompetitorBucketsPipeline implements Pipeline {
  stepKey = 'competitor-buckets';
  private readonly logger = new Logger(CompetitorBucketsPipeline.name);

  constructor(
    private readonly ahrefs: AhrefsService,
    private readonly serper: SerperService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string) || 'us';
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

    // 1. Fetch organic competitors from Ahrefs
    this.logger.log(`Competitor buckets: fetching competing domains for ${domain}`);
    const competingDomains = await this.ahrefs.getCompetingDomains(domain, country, 20);
    apiCallCount++;

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
