import { Module } from '@nestjs/common';
import { OnDemandAgentsController } from './on-demand-agents.controller';
import { OnDemandAgentsService } from './on-demand-agents.service';
import { AgentRouterService } from './agent-router.service';
import { ContextBuilderRegistry } from './context-builders/context-builder.registry';
import { ContentRefreshBuilder } from './context-builders/content-refresh.builder';
import { AiSearchVisibilityBuilder } from './context-builders/ai-search-visibility.builder';
import { TechnicalIssuesBuilder } from './context-builders/technical-issues.builder';
import { KeywordOpportunityBuilder } from './context-builders/keyword-opportunity.builder';
import { GoogleVsAiBuilder } from './context-builders/google-vs-ai.builder';
import { KeywordDecayBuilder } from './context-builders/keyword-decay.builder';
import { CompetitorAnalysisBuilder } from './context-builders/competitor-analysis.builder';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [CreditsModule],
  controllers: [OnDemandAgentsController],
  providers: [
    OnDemandAgentsService,
    AgentRouterService,
    ContextBuilderRegistry,
    ContentRefreshBuilder,
    AiSearchVisibilityBuilder,
    TechnicalIssuesBuilder,
    KeywordOpportunityBuilder,
    GoogleVsAiBuilder,
    KeywordDecayBuilder,
    CompetitorAnalysisBuilder,
  ],
  exports: [OnDemandAgentsService],
})
export class OnDemandAgentsModule {}
