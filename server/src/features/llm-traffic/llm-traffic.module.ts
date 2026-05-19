import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LlmTrafficController } from './llm-traffic.controller';
import { LlmTrafficService } from './llm-traffic.service';
import { LlmTrafficProcessor } from './llm-traffic.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'llm-traffic',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [LlmTrafficController],
  providers: [LlmTrafficService, LlmTrafficProcessor],
  exports: [LlmTrafficService],
})
export class LlmTrafficModule implements OnModuleInit {
  private readonly logger = new Logger(LlmTrafficModule.name);

  constructor(@InjectQueue('llm-traffic') private readonly trafficQueue: Queue) {}

  async onModuleInit() {
    // Daily aggregation at 02:00 UTC
    await this.trafficQueue.upsertJobScheduler(
      'daily-aggregation',
      { pattern: '0 2 * * *' },
      { name: 'aggregate-daily', data: {} },
    );

    // Weekly purge on Sundays at 03:00 UTC
    await this.trafficQueue.upsertJobScheduler(
      'weekly-purge',
      { pattern: '0 3 * * 0' },
      { name: 'purge-expired', data: {} },
    );

    this.logger.log('LLM Traffic crons scheduled: daily aggregation (02:00), weekly purge (Sun 03:00)');
  }
}
