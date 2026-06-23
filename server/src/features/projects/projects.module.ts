import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { BusinessProfileService } from './business-profile.service';
import { ProjectIntelligenceService } from './project-intelligence.service';
import { BusinessProfileProcessor } from './business-profile.processor';
import { CreditsModule } from '../credits/credits.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PlanLimitGuard } from '../billing/plan-limit.guard';

@Module({
  imports: [
    CreditsModule,
    IntegrationsModule,
    BullModule.registerQueue({
      name: 'business-profile',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, BusinessProfileService, ProjectIntelligenceService, BusinessProfileProcessor, PlanLimitGuard],
  exports: [ProjectsService, ProjectIntelligenceService],
})
export class ProjectsModule {}
