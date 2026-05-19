import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GscService } from './gsc.service';
import { GscController } from './gsc.controller';
import { GscSyncProcessor } from './gsc-sync.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'gsc-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    }),
  ],
  controllers: [GscController],
  providers: [GscService, GscSyncProcessor],
  exports: [GscService],
})
export class GscModule {}
