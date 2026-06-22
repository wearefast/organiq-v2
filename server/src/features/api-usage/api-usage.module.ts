import { Global, Module } from '@nestjs/common';
import { ApiUsageContextService } from './api-usage-context.service';
import { ApiUsageService } from './api-usage.service';

@Global()
@Module({
  providers: [ApiUsageContextService, ApiUsageService],
  exports: [ApiUsageContextService, ApiUsageService],
})
export class ApiUsageModule {}
