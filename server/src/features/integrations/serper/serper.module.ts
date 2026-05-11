import { Module } from '@nestjs/common';
import { SerperService } from './serper.service';

@Module({
  providers: [SerperService],
  exports: [SerperService],
})
export class SerperModule {}
