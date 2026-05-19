import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Registers a repeatable job that checks for due workflows every 5 minutes.
 */
@Injectable()
export class WorkflowSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowSchedulerService.name);

  constructor(
    @InjectQueue('scheduled-workflows') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    try {
      // Remove existing repeatable jobs to avoid duplicates on restart
      const existing = await this.queue.getRepeatableJobs();
      for (const job of existing) {
        await this.queue.removeRepeatableByKey(job.key);
      }

      // Schedule a check every 5 minutes
      await this.queue.add(
        'check-due-workflows',
        {},
        {
          repeat: { pattern: '*/5 * * * *' },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.log('Workflow scheduler registered (every 5 minutes)');
    } catch (error) {
      this.logger.error('Failed to register workflow scheduler', error);
    }
  }
}
