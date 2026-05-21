import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { CompetitorMetricsPipeline } from './competitor-metrics.pipeline';
import { SearchDemandPipeline } from './search-demand.pipeline';
import { Method01CompetitorPagesPipeline } from './method01-competitor-pages.pipeline';
import { Method02SeedExpansionPipeline } from './method02-seed-expansion.pipeline';
import { Method03ContentGapPipeline } from './method03-content-gap.pipeline';
import { BusinessProfilePipeline } from './business-profile.pipeline';
import { SeedKeywordsPipeline } from './seed-keywords.pipeline';
import { SerpNicheMapPipeline } from './serp-niche-map.pipeline';
import { CompetitorBucketsPipeline } from './competitor-buckets.pipeline';
import { Phase1BaselinePipeline } from './phase1-baseline.pipeline';
import { ContentBriefPipeline } from './content-brief.pipeline';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly registry = new Map<string, Pipeline>();

  constructor(
    competitorMetrics: CompetitorMetricsPipeline,
    searchDemand: SearchDemandPipeline,
    method01: Method01CompetitorPagesPipeline,
    method02: Method02SeedExpansionPipeline,
    method03: Method03ContentGapPipeline,
    businessProfile: BusinessProfilePipeline,
    seedKeywords: SeedKeywordsPipeline,
    serpNicheMap: SerpNicheMapPipeline,
    competitorBuckets: CompetitorBucketsPipeline,
    phase1Baseline: Phase1BaselinePipeline,
    contentBrief: ContentBriefPipeline,
  ) {
    const pipelines: Pipeline[] = [
      competitorMetrics,
      searchDemand,
      method01,
      method02,
      method03,
      businessProfile,
      seedKeywords,
      serpNicheMap,
      competitorBuckets,
      phase1Baseline,
      contentBrief,
    ];
    for (const p of pipelines) {
      this.registry.set(p.stepKey, p);
    }
  }

  /** Get a pipeline for the given step key, or null if not registered */
  getPipeline(stepKey: string): Pipeline | null {
    return this.registry.get(stepKey) ?? null;
  }

  /** Execute a pipeline step */
  async execute(stepKey: string, context: Record<string, unknown>): Promise<unknown> {
    const pipeline = this.getPipeline(stepKey);
    if (!pipeline) {
      throw new Error(`No pipeline registered for step: ${stepKey}`);
    }

    this.logger.log(`Executing pipeline: ${stepKey}`);
    return pipeline.execute(context);
  }
}
