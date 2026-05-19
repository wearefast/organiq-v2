import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';
import { DecayDetectionService } from './decay-detection.service';
import { DecayDetectionProcessor } from './decay-detection.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'decay-detection',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [KeywordsController],
  providers: [KeywordsService, DecayDetectionService, DecayDetectionProcessor],
  exports: [KeywordsService, DecayDetectionService],
})
export class KeywordsModule implements OnModuleInit {
  private readonly logger = new Logger(KeywordsModule.name);

  constructor(@InjectQueue('decay-detection') private readonly decayQueue: Queue) {}

  async onModuleInit() {
    // Schedule daily decay detection at 06:00 UTC (after GSC sync at 04:00)
    await this.decayQueue.upsertJobScheduler(
      'daily-decay-scan',
      { pattern: '0 6 * * *' },
      { name: 'daily-scan', data: {} },
    );
    this.logger.log('Decay detection daily cron scheduled (06:00 UTC)');
  }
}
