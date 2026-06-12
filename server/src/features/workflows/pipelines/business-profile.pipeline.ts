import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { FirecrawlService } from '../../integrations/firecrawl/firecrawl.service';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

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
    private readonly dataforseo: DataForSeoService,
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
            const backlinkData = await this.dataforseo.getBacklinksSummary(domain);
            apiCallCount++;
            // DataForSEO /backlinks/summary/live returns { tasks[0].result[0]: { backlinks, dofollow, referring_domains, referring_main_domains, rank, main_domain_rank } }
            const blRaw = backlinkData as {
              tasks?: Array<{ result?: Array<{
                backlinks?: number;
                dofollow?: number;
                referring_domains?: number;
                referring_main_domains?: number;
                rank?: number;
                main_domain_rank?: number;
              }> }>;
            };
            const bl = blRaw?.tasks?.[0]?.result?.[0];
            return {
              domainAuthority: {
                domain_rating: bl?.main_domain_rank ? Math.round(bl.main_domain_rank / 10) : null,
                ahrefs_rank: bl?.rank ?? null,
                referring_domains: bl?.referring_domains ?? null,
                backlinks: bl?.backlinks ?? null,
                backlinks_all_time: bl?.backlinks ?? null,
                data_source: 'dataforseo',
              },
            };
          } catch (err) {
            this.logger.warn(`DataForSEO backlinks enrichment failed for ${domain}: ${(err as Error).message}`);
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
