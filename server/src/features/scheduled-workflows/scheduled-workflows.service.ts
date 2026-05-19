import { Injectable, Logger } from '@nestjs/common';
import { eq, desc, and, lte } from 'drizzle-orm';
import { CronExpressionParser } from 'cron-parser';
import { DatabaseService } from '../../shared/database/database.service';
import { scheduledWorkflows, workflowRunHistory } from '../../db/schema';

export interface CreateWorkflowDto {
  projectId: string;
  organizationId: string;
  name: string;
  agentType: string;
  prompt: string;
  scheduleCron: string;
  deliveryChannel: string;
  deliveryTarget: string;
}

export interface UpdateWorkflowDto {
  name?: string;
  prompt?: string;
  scheduleCron?: string;
  deliveryChannel?: string;
  deliveryTarget?: string;
  isActive?: boolean;
}

@Injectable()
export class ScheduledWorkflowsService {
  private readonly logger = new Logger(ScheduledWorkflowsService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateWorkflowDto) {
    const nextRunAt = this.computeNextRunAt(dto.scheduleCron);
    const [workflow] = await this.db.db
      .insert(scheduledWorkflows)
      .values({
        projectId: dto.projectId,
        organizationId: dto.organizationId,
        name: dto.name,
        agentType: dto.agentType,
        prompt: dto.prompt,
        scheduleCron: dto.scheduleCron,
        deliveryChannel: dto.deliveryChannel,
        deliveryTarget: dto.deliveryTarget,
        nextRunAt,
      })
      .returning();
    return workflow;
  }

  async update(workflowId: string, dto: UpdateWorkflowDto) {
    const values: Record<string, unknown> = {};
    if (dto.name !== undefined) values.name = dto.name;
    if (dto.prompt !== undefined) values.prompt = dto.prompt;
    if (dto.scheduleCron !== undefined) {
      values.scheduleCron = dto.scheduleCron;
      values.nextRunAt = this.computeNextRunAt(dto.scheduleCron);
    }
    if (dto.deliveryChannel !== undefined) values.deliveryChannel = dto.deliveryChannel;
    if (dto.deliveryTarget !== undefined) values.deliveryTarget = dto.deliveryTarget;
    if (dto.isActive !== undefined) values.isActive = dto.isActive;

    const [updated] = await this.db.db
      .update(scheduledWorkflows)
      .set(values)
      .where(eq(scheduledWorkflows.id, workflowId))
      .returning();
    return updated;
  }

  async delete(workflowId: string) {
    await this.db.db.delete(scheduledWorkflows).where(eq(scheduledWorkflows.id, workflowId));
  }

  async findByProject(projectId: string) {
    return this.db.db.query.scheduledWorkflows.findMany({
      where: eq(scheduledWorkflows.projectId, projectId),
      orderBy: [desc(scheduledWorkflows.createdAt)],
    });
  }

  async findById(workflowId: string) {
    return this.db.db.query.scheduledWorkflows.findFirst({
      where: eq(scheduledWorkflows.id, workflowId),
    });
  }

  async getRunHistory(workflowId: string, limit = 20) {
    return this.db.db.query.workflowRunHistory.findMany({
      where: eq(workflowRunHistory.workflowId, workflowId),
      orderBy: [desc(workflowRunHistory.ranAt)],
      limit,
    });
  }

  async findDueWorkflows(): Promise<typeof scheduledWorkflows.$inferSelect[]> {
    const now = new Date();
    return this.db.db.query.scheduledWorkflows.findMany({
      where: and(
        eq(scheduledWorkflows.isActive, true),
        lte(scheduledWorkflows.nextRunAt, now),
      ),
    });
  }

  async recordRun(params: {
    workflowId: string;
    projectId: string;
    status: string;
    agentResponse?: string;
    delivered: boolean;
    errorMessage?: string;
  }) {
    await this.db.db.insert(workflowRunHistory).values({
      workflowId: params.workflowId,
      projectId: params.projectId,
      status: params.status,
      agentResponse: params.agentResponse,
      delivered: params.delivered,
      errorMessage: params.errorMessage,
    });

    // Update lastRunAt and compute nextRunAt
    const workflow = await this.findById(params.workflowId);
    if (workflow) {
      await this.db.db
        .update(scheduledWorkflows)
        .set({
          lastRunAt: new Date(),
          nextRunAt: this.computeNextRunAt(workflow.scheduleCron),
        })
        .where(eq(scheduledWorkflows.id, params.workflowId));
    }
  }

  private computeNextRunAt(cron: string): Date {
    try {
      const interval = CronExpressionParser.parse(cron);
      return interval.next().toDate();
    } catch {
      // Fallback: 24 hours from now if cron is unparseable
      this.logger.warn(`Invalid cron expression: ${cron}, defaulting to +24h`);
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }
}
