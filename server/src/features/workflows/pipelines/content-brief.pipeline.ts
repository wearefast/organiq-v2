import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { SerperService } from '../../integrations/serper/serper.service';
import { FirecrawlService } from '../../integrations/firecrawl/firecrawl.service';

/**
 * V7 Pipeline: Content Brief
 * Searches for the target keyword and scrapes top 3 results to give agent
 * real competitive content data. Returns raw content for agent analysis.
 */
@Injectable()
export class ContentBriefPipeline implements Pipeline {
  stepKey = 'content-brief';
  private readonly logger = new Logger(ContentBriefPipeline.name);

  constructor(
    private readonly serper: SerperService,
    private readonly firecrawl: FirecrawlService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const country = (context.country as string) || 'us';
    const start = Date.now();

    // Target keyword comes from the topical-map calendar — the first scheduled content piece.
    // topical-map is a guaranteed upstream dependency (STEP_DEFINITIONS: content-brief depends on topical-map).
    // Schema: context['topical-map'].calendar[0].pieces[0].keyword
    const topicalMap = context['topical-map'] as {
      calendar?: Array<{
        month?: number;
        label?: string;
        pieces?: Array<{ keyword?: string; title?: string }>;
      }>;
    } | undefined;

    const targetKeyword =
      (context.targetKeyword as string) ||
      topicalMap?.calendar?.[0]?.pieces?.[0]?.keyword ||
      '';

    if (!targetKeyword) {
      this.logger.warn('content-brief pipeline: no targetKeyword found in context, returning empty');
      return {
        rawData: { serpResults: null, scrapedPages: [] },
        metadata: { targetKeyword: '', apiCallCount: 0, durationMs: Date.now() - start },
      };
    }

    this.logger.log(`Content brief: researching "${targetKeyword}"`);
    let apiCallCount = 0;

    // 1. Get SERP results for the target keyword
    const serpResults = await this.serper.search({ query: targetKeyword, country, num: 10 });
    apiCallCount++;

    // 2. Scrape top 3 organic results for content intelligence
    const serpData = serpResults as { organic?: Array<{ link?: string }> };
    const topUrls = (serpData?.organic ?? [])
      .map((r) => r.link)
      .filter(Boolean)
      .slice(0, 3) as string[];

    const scrapedPages: Array<{ url: string; data: unknown }> = [];
    await Promise.all(
      topUrls.map(async (url) => {
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
        targetKeyword,
        serpResults,
        scrapedPages,
      },
      metadata: {
        targetKeyword,
        country,
        pagesScraped: scrapedPages.filter((p) => p.data !== null).length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }
}
