import { Module } from '@nestjs/common';
import { AhrefsModule } from './ahrefs/ahrefs.module';
import { DataForSeoModule } from './dataforseo/dataforseo.module';
import { FirecrawlModule } from './firecrawl/firecrawl.module';
import { OpenAiModule } from './openai/openai.module';
import { PageSpeedModule } from './pagespeed/pagespeed.module';
import { SerperModule } from './serper/serper.module';
import { GscModule } from './gsc/gsc.module';

@Module({
  imports: [
    AhrefsModule,
    DataForSeoModule,
    FirecrawlModule,
    OpenAiModule,
    PageSpeedModule,
    SerperModule,
    GscModule,
  ],
  exports: [
    AhrefsModule,
    DataForSeoModule,
    FirecrawlModule,
    OpenAiModule,
    PageSpeedModule,
    SerperModule,
    GscModule,
  ],
})
export class IntegrationsModule {}
