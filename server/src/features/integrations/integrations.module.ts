import { Module } from '@nestjs/common';
import { AhrefsService } from './services/ahrefs.service';
import { SerpApiService } from './services/serpapi.service';
import { OpenAIService } from './services/openai.service';
import { PageSpeedService } from './services/pagespeed.service';
import { ScraperService } from './services/scraper.service';

@Module({
  providers: [
    AhrefsService,
    SerpApiService,
    OpenAIService,
    PageSpeedService,
    ScraperService,
  ],
  exports: [
    AhrefsService,
    SerpApiService,
    OpenAIService,
    PageSpeedService,
    ScraperService,
  ],
})
export class IntegrationsModule {}
