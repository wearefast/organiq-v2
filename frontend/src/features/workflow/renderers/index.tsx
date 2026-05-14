import { BusinessProfileRenderer } from './business-profile';
import { SeedKeywordsRenderer } from './seed-keywords';
import { SiteAuditRenderer } from './site-audit';
import { AiIntelligenceRenderer } from './ai-intelligence';
import { SearchDemandRenderer } from './search-demand';
import { SerpNicheMapRenderer } from './serp-niche-map';
import { CompetitorBucketsRenderer } from './competitor-buckets';
import { CompetitorMetricsRenderer } from './competitor-metrics';
import { Phase1BaselineRenderer } from './phase1-baseline';
import { Method01Renderer } from './method01-competitor-pages';
import { Method02Renderer } from './method02-seed-expansion';
import { Method03Renderer } from './method03-content-gap';
import { ConsolidatedKeywordsRenderer } from './consolidated-keywords';
import { VerdictStrategyRenderer } from './verdict-strategy';
import { TopicalMapRenderer } from './topical-map';
import { ContentBriefRenderer } from './content-brief';
import { ContentArticleRenderer } from './content-article';
import { ContentImagesRenderer } from './content-images';

import type { WorkflowStep } from '../types';

const RENDERERS: Record<string, React.ComponentType<{ data: unknown; allSteps?: WorkflowStep[] }>> = {
  'business-profile': BusinessProfileRenderer,
  'seed-keywords': SeedKeywordsRenderer,
  'site-audit': SiteAuditRenderer,
  'ai-intelligence': AiIntelligenceRenderer,
  'search-demand': SearchDemandRenderer,
  'serp-niche-map': SerpNicheMapRenderer,
  'competitor-buckets': CompetitorBucketsRenderer,
  'competitor-metrics': CompetitorMetricsRenderer,
  'phase1-baseline': Phase1BaselineRenderer,
  'method01-competitor-pages': Method01Renderer,
  'method02-seed-expansion': Method02Renderer,
  'method03-content-gap-import': Method03Renderer,
  'consolidated-keywords': ConsolidatedKeywordsRenderer,
  'verdict-strategy': VerdictStrategyRenderer,
  'topical-map': TopicalMapRenderer,
  'content-brief': ContentBriefRenderer,
  'content-article': ContentArticleRenderer,
  'content-images': ContentImagesRenderer,
};

export function renderArtifact(
  stepKey: string,
  data: unknown,
  allSteps?: WorkflowStep[],
): React.ReactNode {
  const Renderer = RENDERERS[stepKey];
  if (Renderer) {
    return <Renderer data={data} allSteps={allSteps} />;
  }
  return undefined;
}
