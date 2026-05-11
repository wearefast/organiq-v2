import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import {
  workflowRuns,
  workflowSteps,
  stepArtifacts,
  stepApprovals,
  workflowContext,
  projects,
} from '../../db/schema';
import { AgentRegistry } from '../../agents/agent.registry';

/** The 17-step workflow definition: stepKey → [stepNumber, phase, dependsOn[]] */
const STEP_DEFINITIONS: Array<[string, number, number, string[]]> = [
  ['business-profile', 1, 1, []],
  ['seed-keywords', 2, 1, ['business-profile']],
  ['site-audit', 3, 1, ['business-profile']],
  ['ai-intelligence', 4, 1, ['site-audit']],
  ['serp-niche-map', 5, 1, ['seed-keywords']],
  ['competitor-buckets', 6, 1, ['serp-niche-map']],
  ['competitor-metrics', 7, 1, ['ai-intelligence', 'competitor-buckets']],
  ['search-demand', 8, 1, ['seed-keywords']],
  ['phase1-baseline', 9, 2, ['competitor-metrics', 'search-demand']],
  ['method01-competitor-pages', 10, 2, ['phase1-baseline']],
  ['method02-seed-expansion', 11, 2, ['phase1-baseline']],
  ['method03-content-gap-import', 12, 2, ['phase1-baseline']],
  ['consolidated-keywords', 13, 2, ['method01-competitor-pages', 'method02-seed-expansion', 'method03-content-gap-import']],
  ['verdict-strategy', 14, 3, ['consolidated-keywords']],
  ['topical-map', 15, 3, ['verdict-strategy']],
  ['content-brief', 16, 4, ['topical-map']],
  ['content-article', 17, 4, ['content-brief']],
];

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly agentRegistry: AgentRegistry,
    @InjectQueue('workflow-steps') private readonly workflowQueue: Queue,
  ) {}

  async createRun(projectId: string, organizationId: string) {
    return this.db.db.transaction(async (tx) => {
      // Create the run
      const [run] = await tx
        .insert(workflowRuns)
        .values({ projectId, organizationId, status: 'draft' })
        .returning();

      // Create all 17 steps
      const stepValues = STEP_DEFINITIONS.map(([stepKey, stepNumber, phase]) => ({
        workflowRunId: run.id,
        stepKey,
        stepNumber,
        phase,
        status: 'pending' as const,
      }));

      await tx.insert(workflowSteps).values(stepValues);

      this.logger.log(`Created workflow run ${run.id} with ${stepValues.length} steps`);
      return run;
    });
  }

  async getRun(id: string) {
    const run = await this.db.db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, id),
      with: {
        steps: {
          orderBy: (s, { asc }) => [asc(s.stepNumber)],
          with: {
            artifacts: { orderBy: (a, { desc }) => [desc(a.version)] },
            approvals: { orderBy: (a, { desc }) => [desc(a.createdAt)] },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Workflow run not found');
    return run;
  }

  async listRuns(projectId: string) {
    return this.db.db.query.workflowRuns.findMany({
      where: eq(workflowRuns.projectId, projectId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  }

  async startRun(runId: string) {
    const [updated] = await this.db.db
      .update(workflowRuns)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowRuns.id, runId))
      .returning();

    if (!updated) throw new NotFoundException('Workflow run not found');

    // Inject project-level context for prompt interpolation
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, updated.projectId),
    });
    if (project) {
      await this.setContext(runId, 'domain', project.domain);
      await this.setContext(runId, 'country', project.country);
      await this.setContext(runId, 'language', project.language);
      await this.setContext(runId, 'industry', project.industry ?? '');
    }

    // Enqueue the first step(s) — those with no dependencies
    await this.enqueuePendingSteps(runId);

    return updated;
  }

  /**
   * Find steps whose dependencies are all completed/approved and enqueue them.
   * Uses a transaction to prevent race conditions on dependency reads.
   * Returns the step keys that were enqueued.
   */
  async enqueuePendingSteps(workflowRunId: string): Promise<string[]> {
    // Get the run to pass organizationId to job data
    const run = await this.db.db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, workflowRunId),
      columns: { id: true, organizationId: true },
    });
    if (!run) throw new NotFoundException('Workflow run not found');

    const enqueued: string[] = [];

    await this.db.db.transaction(async (tx) => {
      const steps = await tx.query.workflowSteps.findMany({
        where: eq(workflowSteps.workflowRunId, workflowRunId),
      });

      const statusByKey = new Map(steps.map((s) => [s.stepKey, s.status]));

      for (const [stepKey, , , dependsOn] of STEP_DEFINITIONS) {
        const currentStatus = statusByKey.get(stepKey);
        if (currentStatus !== 'pending') continue;

        const depsComplete = dependsOn.every((dep) => {
          const depStatus = statusByKey.get(dep);
          return depStatus === 'completed' || depStatus === 'approved';
        });

        if (depsComplete) {
          // Mark as running inside the transaction
          await tx
            .update(workflowSteps)
            .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(workflowSteps.workflowRunId, workflowRunId),
                eq(workflowSteps.stepKey, stepKey),
              ),
            );

          enqueued.push(stepKey);
        }
      }
    });

    // Enqueue BullMQ jobs outside the transaction (after commit)
    for (const stepKey of enqueued) {
      await this.workflowQueue.add('execute-step', {
        workflowRunId,
        stepKey,
        organizationId: run.organizationId,
      }, {
        jobId: `${workflowRunId}:${stepKey}`,
      });
    }

    this.logger.log(`Enqueued steps for run ${workflowRunId}: [${enqueued.join(', ')}]`);
    return enqueued;
  }

  /**
   * Handle a human approval decision for a step.
   */
  async handleApproval(
    workflowRunId: string,
    stepKey: string,
    decision: 'approved' | 'revision_requested' | 'rejected',
    reviewerId: string,
    notes?: string,
  ) {
    return this.db.db.transaction(async (tx) => {
      // Get the step
      const step = await tx.query.workflowSteps.findFirst({
        where: and(
          eq(workflowSteps.workflowRunId, workflowRunId),
          eq(workflowSteps.stepKey, stepKey),
        ),
      });

      if (!step) throw new NotFoundException('Step not found');

      // Get the latest artifact
      const artifact = await tx.query.stepArtifacts.findFirst({
        where: and(
          eq(stepArtifacts.workflowRunId, workflowRunId),
          eq(stepArtifacts.stepKey, stepKey),
        ),
        orderBy: (a, { desc }) => [desc(a.version)],
      });

      if (!artifact) throw new NotFoundException('No artifact found for step');

      // Record the approval
      await tx.insert(stepApprovals).values({
        workflowStepId: step.id,
        artifactId: artifact.id,
        decision,
        notes: notes ?? null,
        reviewerId,
      });

      // Update step status
      const newStatus = decision === 'approved' ? 'approved' : decision;
      await tx
        .update(workflowSteps)
        .set({
          status: newStatus,
          completedAt: decision === 'approved' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(workflowSteps.id, step.id));

      return { step: stepKey, decision };
    });
  }

  /**
   * Get context values for a workflow run (inter-step state).
   */
  async getContext(workflowRunId: string): Promise<Record<string, unknown>> {
    const rows = await this.db.db.query.workflowContext.findMany({
      where: eq(workflowContext.workflowRunId, workflowRunId),
    });

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /**
   * Set a context value (upsert).
   */
  async setContext(workflowRunId: string, key: string, value: unknown) {
    await this.db.db
      .insert(workflowContext)
      .values({ workflowRunId, key, value })
      .onConflictDoUpdate({
        target: [workflowContext.workflowRunId, workflowContext.key],
        set: { value, updatedAt: new Date() },
      });
  }
}
