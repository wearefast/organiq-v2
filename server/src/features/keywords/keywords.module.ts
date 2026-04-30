import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'keyword-queue' })],
  controllers: [KeywordsController],
  providers: [KeywordsService],
  exports: [KeywordsService],
})
export class KeywordsModule {}
