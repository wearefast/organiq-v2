import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * Tier 1 pipeline: Method 01 — Competitor Pages
 * Fetches top organic pages from each competitor, extracts keyword opportunities.
 * No LLM needed — pure API aggregation.
 */
@Injectable()
export class Method01CompetitorPagesPipeline implements Pipeline {
  stepKey = 'method01-competitor-pages';
  private readonly logger = new Logger(Method01CompetitorPagesPipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const competitors = (context.competitors as string[]) || [];
    const country = (context.country as string) || 'us';
    const pagesPerCompetitor = (context.pagesPerCompetitor as number) || 50;

    this.logger.log(`Method 01: Fetching top pages from ${competitors.length} competitors`);

    const allPages: Array<Record<string, unknown>> = [];

    for (const competitor of competitors) {
      try {
        const pages = await this.ahrefs.getOrganicPages(competitor, country, pagesPerCompetitor);
        const pagesArray = Array.isArray(pages) ? pages : ((pages as Record<string, unknown>)?.pages as unknown[]) || [];

        for (const page of pagesArray as Array<Record<string, unknown>>) {
          allPages.push({
            ...page,
            sourceDomain: competitor,
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch pages for ${competitor}: ${(error as Error).message}`);
      }
    }

    // Extract unique keywords from pages
    const keywordSet = new Set<string>();
    const keywords: Array<{ keyword: string; sourceDomain: string; url: string }> = [];

    for (const page of allPages) {
      const kw = String(page.keyword || '').trim().toLowerCase();
      if (kw && !keywordSet.has(kw)) {
        keywordSet.add(kw);
        keywords.push({
          keyword: kw,
          sourceDomain: page.sourceDomain as string,
          url: String(page.url || ''),
        });
      }
    }

    return {
      pages: allPages,
      keywords,
      meta: {
        totalPages: allPages.length,
        uniqueKeywords: keywords.length,
        competitorsProcessed: competitors.length,
        country,
      },
    };
  }
}
