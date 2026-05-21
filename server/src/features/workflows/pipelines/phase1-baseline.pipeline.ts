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

    const [organicKeywords, organicPages] = await Promise.all([
      this.ahrefs.getOrganicKeywords(domain, country, 50),
      this.ahrefs.getOrganicPages(domain, country, 20),
    ]);

    return {
      rawData: {
        organicKeywords,
        organicPages,
      },
      metadata: {
        domain,
        country,
        apiCallCount: 2,
        durationMs: Date.now() - start,
      },
    };
  }
}
