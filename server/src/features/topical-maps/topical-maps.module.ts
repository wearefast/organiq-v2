import { Module } from '@nestjs/common';
import { TopicalMapsController } from './topical-maps.controller';
import { TopicalMapsService } from './topical-maps.service';

@Module({
  controllers: [TopicalMapsController],
  providers: [TopicalMapsService],
  exports: [TopicalMapsService],
})
export class TopicalMapsModule {}
