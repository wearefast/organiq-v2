import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowProcessor } from './workflow.processor';
import { WorkflowGateway } from './workflow.gateway';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'workflow-steps',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
    CreditsModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowProcessor, WorkflowGateway],
  exports: [WorkflowService, WorkflowGateway],
})
export class WorkflowsModule {}
