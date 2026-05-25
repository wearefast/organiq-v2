import { Global, Module } from '@nestjs/common';
import { WebCrawlerService } from './web-crawler.service';

/**
 * Global module — WebCrawlerService is available for injection in any feature
 * without explicitly importing this module. Add it to AppModule once.
 */
@Global()
@Module({
  providers: [WebCrawlerService],
  exports: [WebCrawlerService],
})
export class WebCrawlerModule {}
