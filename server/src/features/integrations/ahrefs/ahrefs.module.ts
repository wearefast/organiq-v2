import { Module } from '@nestjs/common';
import { AhrefsService } from './ahrefs.service';

@Module({
  providers: [AhrefsService],
  exports: [AhrefsService],
})
export class AhrefsModule {}
