import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PromptVisibilityService } from './prompt-visibility.service';

@Processor('prompt-visibility')
export class PromptVisibilityProcessor extends WorkerHost {
  private readonly logger = new Logger(PromptVisibilityProcessor.name);

  constructor(private readonly service: PromptVisibilityService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'check-all':
        this.logger.log('Running scheduled prompt visibility check');
        await this.service.checkAllActivePrompts();
        break;
      case 'check-single':
        await this.service.checkPrompt(job.data.promptId);
        break;
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }
}
