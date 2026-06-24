import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PromptVisibilityService } from './prompt-visibility.service';
import { PromptVisibilityController } from './prompt-visibility.controller';
import { PromptVisibilityProcessor } from './prompt-visibility.processor';
import { EngineQueryService } from './engine-query.service';
import { VisibilityParserService } from './visibility-parser.service';

@Module({
  imports: [BullModule.registerQueue({
    name: 'prompt-visibility',
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  })],
  controllers: [PromptVisibilityController],
  providers: [
    PromptVisibilityService,
    PromptVisibilityProcessor,
    EngineQueryService,
    VisibilityParserService,
  ],
  exports: [PromptVisibilityService, VisibilityParserService],
})
export class PromptVisibilityModule implements OnModuleInit {
  private readonly logger = new Logger(PromptVisibilityModule.name);

  constructor(
    @InjectQueue('prompt-visibility') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    // Schedule daily prompt visibility check at 04:00 UTC
    await this.queue.upsertJobScheduler(
      'daily-prompt-check',
      { pattern: '0 4 * * *' },
      { name: 'check-all', data: {} },
    );
    this.logger.log('Scheduled daily prompt visibility check at 04:00 UTC');
  }
}
