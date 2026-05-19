import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * Listens to BullMQ queue events and logs job lifecycle for observability.
 */
@Injectable()
export class WorkflowQueueListenerService implements OnModuleInit {
  private queueEvents: QueueEvents;

  constructor(
    @InjectQueue('workflow-steps') private readonly queue: Queue,
    @InjectPinoLogger(WorkflowQueueListenerService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit() {
    const connection = (this.queue as any).opts?.connection;
    this.queueEvents = new QueueEvents('workflow-steps', { connection });

    this.queueEvents.on('active', ({ jobId }) => {
      this.logger.info({ jobId, event: 'job.active' }, 'Job started processing');
    });

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.logger.info(
        { jobId, event: 'job.completed', returnvalue: returnvalue?.slice?.(0, 200) },
        'Job completed successfully',
      );
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(
        { jobId, event: 'job.failed', reason: failedReason },
        'Job failed',
      );
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      this.logger.warn({ jobId, event: 'job.stalled' }, 'Job stalled');
    });

    this.logger.info('BullMQ queue event listeners initialized');
  }
}
