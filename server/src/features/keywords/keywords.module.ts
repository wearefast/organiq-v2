import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';
import { KeywordWorkflowProcessor } from './keywords-workflow.processor';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'keyword-queue' }),
    IntegrationsModule,
  ],
  controllers: [KeywordsController],
  providers: [KeywordsService, KeywordWorkflowProcessor],
  exports: [KeywordsService],
})
export class KeywordsModule {}
