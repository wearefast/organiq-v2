import { Module } from '@nestjs/common';
import { LlmAuditService } from './llm-audit.service';
import { LlmAuditController } from './llm-audit.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [LlmAuditController],
  providers: [LlmAuditService],
  exports: [LlmAuditService],
})
export class LlmAuditModule {}
