import { Module } from '@nestjs/common';
import { PageSpeedService } from './pagespeed.service';

@Module({
  providers: [PageSpeedService],
  exports: [PageSpeedService],
})
export class PageSpeedModule {}
