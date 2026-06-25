import { Module } from '@nestjs/common';
import { TopicalMapsController } from './topical-maps.controller';
import { TopicalMapsService } from './topical-maps.service';
import { TopicalMapPagesService } from './topical-map-pages.service';

@Module({
  controllers: [TopicalMapsController],
  providers: [TopicalMapsService, TopicalMapPagesService],
  exports: [TopicalMapsService, TopicalMapPagesService],
})
export class TopicalMapsModule {}
