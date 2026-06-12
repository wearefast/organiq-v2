import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ForumIntelligenceService } from './forum-intelligence.service';

@Processor('forum-intelligence')
export class ForumIntelligenceProcessor extends WorkerHost {
  private readonly logger = new Logger(ForumIntelligenceProcessor.name);

  constructor(private readonly forumService: ForumIntelligenceService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Running forum intelligence scan (job ${job.id})`);
    const total = await this.forumService.runForAllProjects();
    this.logger.log(`Forum intelligence scan complete: ${total} new opportunities found`);
  }
}
