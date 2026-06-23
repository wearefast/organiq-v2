import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BusinessProfileService } from './business-profile.service';

@Processor('business-profile')
export class BusinessProfileProcessor extends WorkerHost {
  private readonly logger = new Logger(BusinessProfileProcessor.name);

  constructor(private readonly service: BusinessProfileService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'refresh':
        this.logger.log(`Refreshing business profile for project ${job.data.projectId} (forceRediscover=${job.data.forceRediscover ?? false})`);
        await this.service.refresh(job.data.projectId, job.data.organizationId, job.data.forceRediscover ?? false);
        this.logger.log(`Business profile refreshed for project ${job.data.projectId}`);
        break;
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }
}
