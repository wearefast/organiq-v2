import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentGenerationService } from './content-generation.service';
import { ForumIntelligenceService } from './forum-intelligence.service';
import { ForumIntelligenceProcessor } from './forum-intelligence.processor';
import { ForumDateEnricherService } from './forum-date-enricher.service';
import { TopicalMapsModule } from '../topical-maps/topical-maps.module';
import { DataForSeoModule } from '../integrations/dataforseo/dataforseo.module';
import { FirecrawlModule } from '../integrations/firecrawl/firecrawl.module';
import { OpenAiModule } from '../integrations/openai/openai.module';

@Module({
  imports: [
    TopicalMapsModule,
    DataForSeoModule,
    FirecrawlModule,
    OpenAiModule,
    BullModule.registerQueue({
      name: 'forum-intelligence',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    }),
  ],
  controllers: [ContentController],
  providers: [ContentService, ContentGenerationService, ForumIntelligenceService, ForumIntelligenceProcessor, ForumDateEnricherService],
  exports: [ContentService, ContentGenerationService, ForumIntelligenceService],
})
export class ContentModule implements OnModuleInit {
  private readonly logger = new Logger(ContentModule.name);

  constructor(@InjectQueue('forum-intelligence') private readonly forumQueue: Queue) {}

  async onModuleInit() {
    await this.forumQueue.upsertJobScheduler(
      'hourly-forum-scan',
      { pattern: '0 * * * *' },
      { name: 'hourly-scan', data: {} },
    );
    this.logger.log('Forum intelligence hourly cron scheduled');
  }
}
