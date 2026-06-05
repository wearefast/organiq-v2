import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { BusinessProfileService } from './business-profile.service';
import { ProjectIntelligenceService } from './project-intelligence.service';
import { CreditsModule } from '../credits/credits.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [CreditsModule, IntegrationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, BusinessProfileService, ProjectIntelligenceService],
  exports: [ProjectsService, ProjectIntelligenceService],
})
export class ProjectsModule {}
