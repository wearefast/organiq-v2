import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'content-queue' }),
    BullModule.registerQueue({ name: 'keyword-queue' }),
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
