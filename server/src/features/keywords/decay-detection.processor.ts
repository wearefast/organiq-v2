import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DecayDetectionService } from './decay-detection.service';

@Processor('decay-detection')
export class DecayDetectionProcessor extends WorkerHost {
  private readonly logger = new Logger(DecayDetectionProcessor.name);

  constructor(private readonly decayService: DecayDetectionService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Running decay detection scan (job ${job.id})`);
    const alertCount = await this.decayService.runForAllProjects();
    this.logger.log(`Decay detection complete: ${alertCount} total alerts created`);
  }
}
