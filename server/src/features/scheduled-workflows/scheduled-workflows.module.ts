import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduledWorkflowsController } from './scheduled-workflows.controller';
import { ScheduledWorkflowsService } from './scheduled-workflows.service';
import { WorkflowSchedulerService } from './workflow-scheduler.service';
import { WorkflowSchedulerProcessor } from './workflow-scheduler.processor';
import { DeliveryService } from './delivery.service';
import { RetentionService } from './retention.service';
import { OnDemandAgentsModule } from '../on-demand-agents/on-demand-agents.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scheduled-workflows',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    OnDemandAgentsModule,
  ],
  controllers: [ScheduledWorkflowsController],
  providers: [
    ScheduledWorkflowsService,
    WorkflowSchedulerService,
    WorkflowSchedulerProcessor,
    DeliveryService,
    RetentionService,
  ],
  exports: [ScheduledWorkflowsService],
})
export class ScheduledWorkflowsModule {}
