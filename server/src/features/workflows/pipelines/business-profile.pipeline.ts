import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { FirecrawlService } from '../../integrations/firecrawl/firecrawl.service';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * V7 Pipeline: Business Profile
 * Scrapes target domain pages via Firecrawl and returns raw content.
 * Analysis (industry, positioning, brand voice etc.) is handled by the managed agent.
 */
@Injectable()
export class BusinessProfilePipeline implements Pipeline {
  stepKey = 'business-profile';
  private readonly logger = new Logger(BusinessProfilePipeline.name);

  constructor(
    private readonly firecrawl: FirecrawlService,
    private readonly ahrefs: AhrefsService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string | undefined;
    if (!domain) throw new Error('business-profile pipeline requires context.domain');

    const baseUrl = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain}`;
    this.logger.log(`Business profile: scraping ${baseUrl}`);

    const start = Date.now();
    let apiCallCount = 0;

    const pagesToScrape = [
      baseUrl,
      `${baseUrl}/about`,
      `${baseUrl}/services`,
      `${baseUrl}/about-us`,
    ];

    const scrapedPages: Array<{ url: string; data: unknown }> = [];

    await Promise.all(
      pagesToScrape.map(async (url) => {
        try {
          const content = await this.firecrawl.scrape(url);
          apiCallCount++;
          scrapedPages.push({ url, data: content });
        } catch (err) {
          this.logger.warn(`Firecrawl scrape failed for ${url}: ${(err as Error).message}`);
          scrapedPages.push({ url, data: null });
        }
      }),
    );

    return {
      rawData: {
        domain,
        scrapedPages: scrapedPages.filter((p) => p.data !== null),
        ...(await (async () => {
          try {
            const [drData, backlinkData] = await Promise.all([
              this.ahrefs.getDomainRating(domain),
              this.ahrefs.getBacklinksStats(domain),
            ]);
            // Ahrefs v3 /site-explorer/domain-rating returns { domain_rating: { domain_rating: number, ahrefs_rank: number } }
            const dr = drData as { domain_rating?: { domain_rating?: number; ahrefs_rank?: number } } | null;
            // Ahrefs v3 /site-explorer/backlinks-stats returns { metrics: { live, all_time, live_refdomains, all_time_refdomains } }
            const bl = backlinkData as { metrics?: { live?: number; all_time?: number; live_refdomains?: number; all_time_refdomains?: number } } | null;
            return {
              domainAuthority: {
                domain_rating: dr?.domain_rating?.domain_rating ?? null,
                ahrefs_rank: dr?.domain_rating?.ahrefs_rank ?? null,
                referring_domains: bl?.metrics?.live_refdomains ?? null,
                backlinks: bl?.metrics?.live ?? null,
                backlinks_all_time: bl?.metrics?.all_time ?? null,
                data_source: 'ahrefs',
              },
            };
          } catch (err) {
            this.logger.warn(`Ahrefs enrichment failed for ${domain}: ${(err as Error).message}`);
            return {};
          }
        })()),
      },
      metadata: {
        domain,
        pagesAttempted: pagesToScrape.length,
        pagesScraped: scrapedPages.filter((p) => p.data !== null).length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}
