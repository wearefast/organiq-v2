import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { FirecrawlService } from '../../integrations/firecrawl/firecrawl.service';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

/**
 * V8 Pipeline: Business Profile
 * Maps the target site via Firecrawl sitemap to discover real URLs, then picks the
 * most relevant page per content category and scrapes them. No paths are hardcoded —
 * URL selection is driven entirely by what the sitemap actually contains.
 * Analysis (industry, positioning, brand voice etc.) is handled by the managed agent.
 */
@Injectable()
export class BusinessProfilePipeline implements Pipeline {
  stepKey = 'business-profile';
  private readonly logger = new Logger(BusinessProfilePipeline.name);

  // One URL per category, matched against the real sitemap in order.
  // Patterns cover the widest range of CMS conventions (Shopify /pages/*, WordPress,
  // Webflow, custom builds, etc.) without assuming any specific path shape.
  private readonly CATEGORY_PATTERNS: [string, RegExp][] = [
    ['about',   /\/(about|about-us|who-we-are|our-story|company|team)/i],
    ['contact', /\/(contact|contact-us|get-in-touch|reach-us)/i],
    ['faq',     /\/(faq|faqs|frequently-asked|help|support)/i],
    ['blog',    /\/(blog|news|articles|insights|resources|editorial)/i],
    ['services',/\/(services|solutions|what-we-do|offerings)/i],
  ];

  constructor(
    private readonly firecrawl: FirecrawlService,
    private readonly dataforseo: DataForSeoService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string | undefined;
    if (!domain) throw new Error('business-profile pipeline requires context.domain');

    const baseUrl = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain}`;
    const origin = new URL(baseUrl).origin;
    this.logger.log(`Business profile: mapping site for ${origin}`);

    const start = Date.now();
    let apiCallCount = 0;

    // Step 1: Discover real URLs via sitemap — same approach used by site-audit pipeline.
    let sitemapUrls: string[] = [];
    try {
      const siteMap = await this.firecrawl.mapSite(origin) as any;
      apiCallCount++;
      const links: string[] = siteMap?.links ?? siteMap?.urls ?? [];
      sitemapUrls = links.filter((u): u is string => typeof u === 'string');
      this.logger.log(`Business profile: sitemap returned ${sitemapUrls.length} URLs`);
    } catch (err) {
      this.logger.warn(`Business profile: mapSite failed for ${origin} — will scrape homepage only: ${(err as Error).message}`);
    }

    // Step 2: Pick one representative URL per content category from the real sitemap.
    // Homepage is always included; each category adds at most one URL.
    const pagesToScrape: string[] = [baseUrl];
    for (const [label, pattern] of this.CATEGORY_PATTERNS) {
      const match = sitemapUrls.find(url => pattern.test(url));
      if (match && !pagesToScrape.includes(match)) {
        this.logger.log(`Business profile: selected ${label} page → ${match}`);
        pagesToScrape.push(match);
      }
    }

    this.logger.log(`Business profile: scraping ${pagesToScrape.length} pages`);

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
        sitemapUrls,
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
        sitemapUrlsDiscovered: sitemapUrls.length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}
