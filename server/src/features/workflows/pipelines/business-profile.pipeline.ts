import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { FirecrawlService } from '../../integrations/firecrawl/firecrawl.service';

/**
 * V7 Pipeline: Business Profile
 * Scrapes target domain pages via Firecrawl and returns raw content.
 * Analysis (industry, positioning, brand voice etc.) is handled by the managed agent.
 */
@Injectable()
export class BusinessProfilePipeline implements Pipeline {
  stepKey = 'business-profile';
  private readonly logger = new Logger(BusinessProfilePipeline.name);

  constructor(private readonly firecrawl: FirecrawlService) {}

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
