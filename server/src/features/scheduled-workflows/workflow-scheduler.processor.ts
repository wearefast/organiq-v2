import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScheduledWorkflowsService } from './scheduled-workflows.service';
import { OnDemandAgentsService } from '../on-demand-agents/on-demand-agents.service';
import { DeliveryService } from './delivery.service';

@Processor('scheduled-workflows')
export class WorkflowSchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowSchedulerProcessor.name);

  constructor(
    private readonly workflowsService: ScheduledWorkflowsService,
    private readonly agentsService: OnDemandAgentsService,
    private readonly deliveryService: DeliveryService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'check-due-workflows') return;

    const dueWorkflows = await this.workflowsService.findDueWorkflows();
    this.logger.log(`Found ${dueWorkflows.length} due workflows`);

    // Process in batches of 3 to cap concurrent agent API calls.
    // Sequential execution stalled the scheduler when many workflows were due simultaneously.
    const BATCH_SIZE = 3;
    for (let i = 0; i < dueWorkflows.length; i += BATCH_SIZE) {
      const batch = dueWorkflows.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (workflow) => {
          try {
            // Run the agent
            const result = await this.agentsService.run({
              projectId: workflow.projectId,
              organizationId: workflow.organizationId,
              prompt: workflow.prompt,
              agentType: workflow.agentType,
            });

            // Deliver the result
            let delivered = false;
            try {
              await this.deliveryService.deliver({
                channel: workflow.deliveryChannel,
                target: workflow.deliveryTarget,
                workflowName: workflow.name,
                agentResponse: result.response,
                recommendations: result.recommendations,
              });
              delivered = true;
            } catch (deliveryErr) {
              this.logger.warn(`Delivery failed for workflow ${workflow.id}: ${deliveryErr}`);
            }

            await this.workflowsService.recordRun({
              workflowId: workflow.id,
              projectId: workflow.projectId,
              status: 'success',
              agentResponse: result.response,
              delivered,
            });
          } catch (error) {
            const errMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Workflow ${workflow.id} failed: ${errMessage}`);

            await this.workflowsService.recordRun({
              workflowId: workflow.id,
              projectId: workflow.projectId,
              status: 'failed',
              delivered: false,
              errorMessage: errMessage,
            });
          }
        }),
      );
    }
  }
}
