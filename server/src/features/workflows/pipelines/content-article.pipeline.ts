import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { SerperService } from '../../integrations/serper/serper.service';

/**
 * ContentArticlePipeline
 *
 * Pre-fetches fact-supporting reference data for the article writer so that
 * Claude does not need to call serper_search mid-write. The content-brief
 * step already ran SERP + competitor scrapes for the primary keyword; this
 * pipeline adds:
 *   - a "statistics & data" search (common fact-check angle)
 *   - a recent-news search (recency signals for the topic)
 *   - a People-Also-Ask pass (common reader questions)
 *
 * Delivers a small, clean reference corpus. Claude can cross-check any
 * in-text claim against these results instead of calling a tool.
 */
@Injectable()
export class ContentArticlePipeline implements Pipeline {
  readonly stepKey = 'content-article';
  private readonly logger = new Logger(ContentArticlePipeline.name);

  constructor(private readonly serper: SerperService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const start = Date.now();
    const country = (context.country as string) || 'us';
    const errors: string[] = [];

    // Extract the target keyword — written into context by content-brief or
    // passed as a direct context value by verdict-strategy.
    const briefArtifact = context['content-brief'] as
      | { targetKeyword?: string; primaryKeyword?: string; keywords?: { primary?: string } }
      | undefined;

    const targetKeyword =
      (context.targetKeyword as string) ||
      briefArtifact?.targetKeyword ||
      briefArtifact?.primaryKeyword ||
      briefArtifact?.keywords?.primary ||
      '';

    if (!targetKeyword) {
      this.logger.warn('content-article pipeline: no targetKeyword found in context');
      return {
        rawData: { statsSearch: null, newsSearch: null, paaSearch: null },
        metadata: { targetKeyword: '', apiCallCount: 0, durationMs: Date.now() - start, errors },
      };
    }

    const currentYear = new Date().getFullYear();

    this.logger.log(`content-article pipeline: pre-fetching facts for "${targetKeyword}"`);

    const [statsResult, newsResult, paaResult] = await Promise.allSettled([
      // Statistics & data — most common fact-checking angle
      this.serper.search({ query: `${targetKeyword} statistics data ${currentYear}`, country, num: 8 }),
      // Recent developments — gives Claude recency signals
      this.serper.search({ query: `${targetKeyword} ${currentYear}`, country, num: 5, type: 'news' }),
      // PAA-style questions — mirrors what Google shows readers of this topic
      this.serper.search({ query: `what is ${targetKeyword}`, country, num: 5 }),
    ]);

    const extract = <T>(result: PromiseSettledResult<T>, label: string): T | null => {
      if (result.status === 'fulfilled') return result.value;
      const msg = `${label}: ${(result.reason as Error)?.message ?? String(result.reason)}`;
      this.logger.warn(`content-article pipeline error — ${msg}`);
      errors.push(msg);
      return null;
    };

    return {
      rawData: {
        targetKeyword,
        statsSearch: extract(statsResult, 'serper_stats'),
        newsSearch: extract(newsResult, 'serper_news'),
        paaSearch: extract(paaResult, 'serper_paa'),
      },
      metadata: {
        targetKeyword,
        country,
        apiCallCount: 3 - errors.length,
        durationMs: Date.now() - start,
        errors,
      },
    };
  }
}
