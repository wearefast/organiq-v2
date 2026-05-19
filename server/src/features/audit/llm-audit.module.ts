import { Module } from '@nestjs/common';
import { LlmAuditService } from './llm-audit.service';
import { LlmAuditController } from './llm-audit.controller';

@Module({
  controllers: [LlmAuditController],
  providers: [LlmAuditService],
  exports: [LlmAuditService],
})
export class LlmAuditModule {}
