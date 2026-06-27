import { Module } from '@nestjs/common';
import { LlmAuditService } from './llm-audit.service';
import { LlmAuditController } from './llm-audit.controller';
import { ProjectsModule } from '../projects/projects.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [ProjectsModule, CreditsModule],
  controllers: [LlmAuditController],
  providers: [LlmAuditService],
  exports: [LlmAuditService],
})
export class LlmAuditModule {}
