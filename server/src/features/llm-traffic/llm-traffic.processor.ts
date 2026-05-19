import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LlmTrafficService } from './llm-traffic.service';

@Processor('llm-traffic')
export class LlmTrafficProcessor extends WorkerHost {
  private readonly logger = new Logger(LlmTrafficProcessor.name);

  constructor(private readonly trafficService: LlmTrafficService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'aggregate-daily': {
        this.logger.log('Running daily traffic aggregation');
        const rows = await this.trafficService.aggregateDaily();
        this.logger.log(`Aggregation complete: ${rows} stat rows written`);
        break;
      }
      case 'purge-expired': {
        this.logger.log('Running expired session purge (90-day TTL)');
        const purged = await this.trafficService.purgeExpiredSessions();
        this.logger.log(`Purge complete: ${purged} sessions removed`);
        break;
      }
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
