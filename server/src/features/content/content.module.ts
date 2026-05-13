import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { TopicalMapsModule } from '../topical-maps/topical-maps.module';

@Module({
  imports: [TopicalMapsModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
