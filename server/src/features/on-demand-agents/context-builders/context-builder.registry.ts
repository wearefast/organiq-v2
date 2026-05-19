import { Injectable } from '@nestjs/common';
import { AgentType } from '../agent-router.service';
import { ContentRefreshBuilder } from './content-refresh.builder';
import { AiSearchVisibilityBuilder } from './ai-search-visibility.builder';
import { TechnicalIssuesBuilder } from './technical-issues.builder';
import { KeywordOpportunityBuilder } from './keyword-opportunity.builder';
import { GoogleVsAiBuilder } from './google-vs-ai.builder';
import { KeywordDecayBuilder } from './keyword-decay.builder';
import { CompetitorAnalysisBuilder } from './competitor-analysis.builder';

export interface ContextBuilderResult {
  systemPrompt: string;
  dataContext: string;
  summary: string;
}

export interface ContextBuilder {
  build(projectId: string, userPrompt: string): Promise<ContextBuilderResult>;
}

@Injectable()
export class ContextBuilderRegistry {
  private readonly builders: Map<AgentType, ContextBuilder>;

  constructor(
    contentRefresh: ContentRefreshBuilder,
    aiSearchVisibility: AiSearchVisibilityBuilder,
    technicalIssues: TechnicalIssuesBuilder,
    keywordOpportunity: KeywordOpportunityBuilder,
    googleVsAi: GoogleVsAiBuilder,
    keywordDecay: KeywordDecayBuilder,
    competitorAnalysis: CompetitorAnalysisBuilder,
  ) {
    this.builders = new Map<AgentType, ContextBuilder>([
      ['content-refresh', contentRefresh],
      ['ai-search-visibility', aiSearchVisibility],
      ['technical-issues', technicalIssues],
      ['keyword-opportunity', keywordOpportunity],
      ['google-vs-ai', googleVsAi],
      ['keyword-decay', keywordDecay],
      ['competitor-analysis', competitorAnalysis],
    ]);
  }

  get(agentType: AgentType): ContextBuilder {
    const builder = this.builders.get(agentType);
    if (!builder) {
      throw new Error(`No context builder registered for agent type: ${agentType}`);
    }
    return builder;
  }
}
