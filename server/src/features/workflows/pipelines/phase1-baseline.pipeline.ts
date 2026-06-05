import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * V7 Pipeline: Phase 1 Baseline
 * Fetches the target domain's current organic keyword rankings and top pages.
 * Returns raw Ahrefs data for agent analysis — NO baseline scoring here.
 */
@Injectable()
export class Phase1BaselinePipeline implements Pipeline {
  stepKey = 'phase1-baseline';
  private readonly logger = new Logger(Phase1BaselinePipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string) || 'us';
    const start = Date.now();

    if (!domain) throw new Error('phase1-baseline pipeline requires context.domain');

    this.logger.log(`Phase 1 baseline: fetching current rankings for ${domain}`);

    // seed-keywords already called getOrganicKeywords(domain, country, 50) and the Claude
    // agent processed the results into seedKeywords[]. context['seed-keywords'] is that
    // agent output — NOT pipeline rawData (rawData is never stored in workflowContext).
    // Use the structured seedKeywords[] directly to avoid a duplicate Ahrefs call.
    const seedCtx = context['seed-keywords'] as {
      seedKeywords?: Array<{
        keyword: string;
        volume?: number;
        difficulty?: number;
        currentPosition?: number;
        intent?: string;
      }>;
    } | undefined;

    const organicKeywords =
      seedCtx?.seedKeywords && seedCtx.seedKeywords.length > 0
        ? { keywords: seedCtx.seedKeywords.map((k) => ({
            keyword: k.keyword,
            position: k.currentPosition ?? null,
            volume: k.volume ?? 0,
            difficulty: k.difficulty ?? 0,
            intent: k.intent ?? '',
          })) }
        : await this.ahrefs.getOrganicKeywords(domain, country, 50);

    // organic pages are not fetched by seed-keywords — still needs an API call
    const organicPages = await this.ahrefs.getOrganicPages(domain, country, 20);
    const fromContext = seedCtx?.seedKeywords && seedCtx.seedKeywords.length > 0;

    return {
      rawData: {
        organicKeywords,
        organicPages,
      },
      metadata: {
        domain,
        country,
        apiCallCount: fromContext ? 1 : 2,
        organicKeywordsSource: fromContext ? 'seed-keywords-context' : 'ahrefs',
        durationMs: Date.now() - start,
      },
    };
  }
}
