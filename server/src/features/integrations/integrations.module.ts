import { Module } from '@nestjs/common';
import { AhrefsService } from './services/ahrefs.service';
import { SerpService } from './services/serp.service';
import { OpenAIService } from './services/openai.service';
import { PageSpeedService } from './services/pagespeed.service';
import { ScraperService } from './services/scraper.service';

@Module({
  providers: [
    AhrefsService,
    SerpService,
    OpenAIService,
    PageSpeedService,
    ScraperService,
  ],
  exports: [
    AhrefsService,
    SerpService,
    OpenAIService,
    PageSpeedService,
    ScraperService,
  ],
})
export class IntegrationsModule {}
