import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowController } from './workflow.controller';
import { DlqController } from './dlq.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowProcessor } from './workflow.processor';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowMaterializerService } from './workflow-materializer.service';
import { WorkflowQueueListenerService } from './workflow-queue-listener.service';
import { DlqService } from './dlq.service';
import {
  PipelineService,
  CompetitorMetricsPipeline,
  SearchDemandPipeline,
  Method01CompetitorPagesPipeline,
  Method02SeedExpansionPipeline,
  Method03ContentGapPipeline,
  BusinessProfilePipeline,
  SeedKeywordsPipeline,
  SerpNicheMapPipeline,
  CompetitorBucketsPipeline,
  Phase1BaselinePipeline,
  ContentBriefPipeline,
  SiteAuditPipeline,
  ContentArticlePipeline,
  AiIntelligencePipeline,
} from './pipelines';
import { CreditsModule } from '../credits/credits.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { TopicalMapsModule } from '../topical-maps/topical-maps.module';
import { ContentModule } from '../content/content.module';
import { AhrefsModule } from '../integrations/ahrefs/ahrefs.module';
import { DataForSeoModule } from '../integrations/dataforseo/dataforseo.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ProjectsModule } from '../projects/projects.module';

/**
 * Dependency direction: WorkflowsModule → feature modules (Keywords, TopicalMaps, Content).
 * This is strictly one-directional. Feature modules must NEVER import WorkflowsModule.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'workflow-steps',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
    CreditsModule,
    KeywordsModule,
    TopicalMapsModule,
    ContentModule,
    AhrefsModule,
    DataForSeoModule,
    IntegrationsModule,
    ProjectsModule,
  ],
  controllers: [WorkflowController, DlqController],
  providers: [
    WorkflowService, WorkflowProcessor, WorkflowGateway, WorkflowMaterializerService,
    WorkflowQueueListenerService, DlqService,
    PipelineService, CompetitorMetricsPipeline, SearchDemandPipeline,
    Method01CompetitorPagesPipeline, Method02SeedExpansionPipeline, Method03ContentGapPipeline,
    BusinessProfilePipeline,
    SeedKeywordsPipeline, SerpNicheMapPipeline, CompetitorBucketsPipeline,
    Phase1BaselinePipeline, ContentBriefPipeline, SiteAuditPipeline,
    ContentArticlePipeline, AiIntelligencePipeline,
  ],
  exports: [WorkflowService, WorkflowGateway, DlqService],
})
export class WorkflowsModule {}
