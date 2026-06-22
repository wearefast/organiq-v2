import { Global, Module } from '@nestjs/common';
import { PerplexityService } from './perplexity.service';

@Global()
@Module({
  providers: [PerplexityService],
  exports: [PerplexityService],
})
export class PerplexityModule {}
