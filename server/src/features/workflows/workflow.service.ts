import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and, inArray, asc, or } from 'drizzle-orm';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../shared/database/database.service';
import {
  workflowRuns,
  workflowSteps,
  stepArtifacts,
  stepApprovals,
  workflowContext,
  projects,
  stepToolCalls,
} from '../../db/schema';
import { AgentRegistry } from '../../agents/agent.registry';
import { CreditsService } from '../credits/credits.service';

/** The 17-step workflow definition: stepKey → [stepNumber, phase, dependsOn[]] */
export const STEP_DEFINITIONS: Array<[string, number, number, string[]]> = [
  ['seed-keywords', 1, 1, []],
  ['site-audit', 2, 1, []],
  ['ai-intelligence', 3, 1, ['site-audit']],
  ['serp-niche-map', 4, 1, ['seed-keywords']],
  ['competitor-buckets', 5, 1, ['serp-niche-map']],
  ['competitor-metrics', 6, 1, ['ai-intelligence', 'competitor-buckets']],
  ['search-demand', 7, 1, ['seed-keywords']],
  ['phase1-baseline', 8, 2, ['competitor-metrics', 'search-demand']],
  ['method01-competitor-pages', 9, 2, ['phase1-baseline']],
  ['method02-seed-expansion', 10, 2, ['phase1-baseline']],
  ['method03-content-gap-import', 11, 2, ['phase1-baseline', 'method01-competitor-pages', 'method02-seed-expansion']],
  ['consolidated-keywords', 12, 2, ['method01-competitor-pages', 'method02-seed-expansion', 'method03-content-gap-import']],
  ['verdict-strategy', 13, 3, ['consolidated-keywords']],
  ['topical-map', 14, 3, ['verdict-strategy']],
  ['content-brief', 15, 4, ['topical-map']],
  ['content-article', 16, 4, ['content-brief']],
  ['content-images', 17, 4, ['content-article']],
];

@Injectable()
export class WorkflowService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly agentRegistry: AgentRegistry,
    private readonly creditsService: CreditsService,
    @InjectQueue('workflow-steps') private readonly workflowQueue: Queue,
  ) {}

  onModuleInit() {
    this.validateStepDefinitions();
  }

  /**
   * After all modules are initialised, reconcile any runs left stuck in 'running'
   * by a previous server instance (crash, restart, failed deploy).
   *
   * Strategy:
   *  - A step that is still 'running' in the DB but has no live BullMQ job is
   *    orphaned. Mark it 'failed' so the dependency graph can settle.
   *  - After marking orphaned steps, if the run is now unrecoverable (no pending
   *    step can ever become runnable), mark the run 'failed'.
   *  - If the run still has viable pending steps (their deps are all met), re-queue
   *    them so the workflow continues automatically.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.reconcileOrphanedRuns();
    } catch (err) {
      this.logger.error(`Startup reconciliation failed: ${(err as Error).message}`);
    }
  }

  /**
   * Watchdog: runs every 5 minutes and auto-resumes any workflow that is stuck.
   *
   * Two stuck scenarios handled:
   * 1. ALL steps are still 'pending' but the run has been 'running' for > 5 min:
   *    the initial enqueuePendingSteps call must have failed silently after the DB
   *    transaction committed (e.g. Redis was temporarily unavailable). Re-enqueue now.
   *
   * 2. At least one step has been in 'running' state for > 35 min:
   *    the BullMQ job was lost (server crash, worker restart). resumeRun() resets
   *    those orphaned steps to 'pending' and re-enqueues eligible ones.
   */
  @Cron('*/5 * * * *')
  async workflowWatchdog(): Promise<void> {
    let runningRuns: Array<typeof workflowRuns.$inferSelect & { steps: Array<typeof workflowSteps.$inferSelect> }>;
    try {
      runningRuns = await this.db.db.query.workflowRuns.findMany({
        where: eq(workflowRuns.status, 'running'),
        with: { steps: { columns: { stepKey: true, status: true, startedAt: true } } },
      }) as typeof runningRuns;
    } catch (err) {
      this.logger.error(`Watchdog DB query failed: ${(err as Error).message}`);
      return;
    }

    if (runningRuns.length === 0) return;

    const ORPHAN_THRESHOLD_MS = 35 * 60 * 1000; // matches resumeRun's 35-min threshold
    const ENQUEUE_STUCK_THRESHOLD_MS = 5 * 60 * 1000;

    for (const run of runningRuns) {
      try {
        const allPending = run.steps.every((s) => s.status === 'pending');
        const runAgeMs = run.startedAt ? Date.now() - new Date(run.startedAt).getTime() : 0;
        const enqueueStuck = allPending && runAgeMs > ENQUEUE_STUCK_THRESHOLD_MS;

        const hasOrphanedStep = run.steps.some(
          (s) =>
            s.status === 'running' &&
            s.startedAt &&
            Date.now() - new Date(s.startedAt).getTime() > ORPHAN_THRESHOLD_MS,
        );

        if (enqueueStuck) {
          this.logger.warn(
            `Watchdog: run ${run.id.slice(0, 8)} has been running ${Math.round(runAgeMs / 60000)}min with all steps pending — re-enqueueing`,
          );
          await this._doEnqueuePendingSteps(run.id);
        } else if (hasOrphanedStep) {
          this.logger.warn(
            `Watchdog: run ${run.id.slice(0, 8)} has a step stuck in running >35min — invoking resumeRun`,
          );
          await this.resumeRun(run.id);
        }
      } catch (err) {
        this.logger.error(`Watchdog: failed to recover run ${run.id.slice(0, 8)} — ${(err as Error).message}`);
      }
    }
  }

  private async reconcileOrphanedRuns(): Promise<void> {
    const stuckRuns = await this.db.db.query.workflowRuns.findMany({
      where: eq(workflowRuns.status, 'running'),
      with: { steps: true },
    });

    if (stuckRuns.length === 0) {
      this.logger.log('Startup reconciliation: no running workflows to reconcile');
      return;
    }

    this.logger.warn(`Startup reconciliation: found ${stuckRuns.length} running workflow(s) — checking for orphaned jobs`);

    for (const run of stuckRuns) {
      const statusByKey = new Map(run.steps.map((s) => [s.stepKey, s.status]));

      // Any step marked 'running' in the DB has no live BullMQ job (server just started).
      // Mark those as failed so the dependency graph can settle.
      const orphanedRunningSteps = run.steps.filter((s) => s.status === 'running');
      if (orphanedRunningSteps.length > 0) {
        const orphanedKeys = orphanedRunningSteps.map((s) => s.stepKey);
        await this.db.db
          .update(workflowSteps)
          .set({ status: 'pending', startedAt: null, error: null, updatedAt: new Date() })
          .where(and(eq(workflowSteps.workflowRunId, run.id), inArray(workflowSteps.stepKey, orphanedKeys)));
        orphanedKeys.forEach((k) => statusByKey.set(k, 'pending'));
        this.logger.warn(`Run ${run.id}: reset ${orphanedKeys.length} orphaned step(s) to pending for restart: [${orphanedKeys.join(', ')}]`);
      }

      // Re-evaluate the run's recoverability with the updated status map.
      const isBlocked = (key: string, visited = new Set<string>()): boolean => {
        if (visited.has(key)) return false;
        visited.add(key);
        if (statusByKey.get(key) === 'failed') return true;
        const def = STEP_DEFINITIONS.find(([k]) => k === key);
        return def ? def[3].some((dep) => isBlocked(dep, visited)) : false;
      };

      const runnableKeys = STEP_DEFINITIONS
        .filter(([k, , , deps]) => {
          const status = statusByKey.get(k);
          if (status !== 'pending') return false;
          return deps.every((dep) => {
            const s = statusByKey.get(dep);
            return s === 'completed' || s === 'approved';
          }) && !isBlocked(k, new Set());
        })
        .map(([k]) => k);

      if (runnableKeys.length > 0) {
        // Resume: re-enqueue steps whose deps are now satisfied
        this.logger.log(`Run ${run.id}: re-enqueueing ${runnableKeys.length} eligible step(s): [${runnableKeys.join(', ')}]`);
        await this.enqueuePendingSteps(run.id);
      } else {
        // No step can ever run — mark the whole run as failed
        const anyActive = run.steps.some((s) => s.status === 'pending' || s.status === 'running');
        const hasFailure = run.steps.some((s) => s.status === 'failed');
        if (!anyActive || hasFailure) {
          await this.db.db
            .update(workflowRuns)
            .set({ status: 'failed', completedAt: new Date(), updatedAt: new Date() })
            .where(eq(workflowRuns.id, run.id));
          this.logger.warn(`Run ${run.id}: marked as failed (unrecoverable at startup)`);
        }
      }
    }
  }

  /**
   * Validate STEP_DEFINITIONS at startup:
   * 1. No duplicate step keys
   * 2. Every dependsOn reference exists
   * 3. Step numbers are sequential (1..N)
   * 4. No circular dependencies (Kahn's topological sort)
   */
  private validateStepDefinitions(): void {
    const keys = new Set<string>();
    const stepNumbers = new Set<number>();

    // Pass 1: Check duplicates and collect keys
    for (const [stepKey, stepNumber] of STEP_DEFINITIONS) {
      if (keys.has(stepKey)) {
        throw new Error(`STEP_DEFINITIONS: Duplicate step key "${stepKey}"`);
      }
      if (stepNumbers.has(stepNumber)) {
        throw new Error(`STEP_DEFINITIONS: Duplicate step number ${stepNumber}`);
      }
      keys.add(stepKey);
      stepNumbers.add(stepNumber);
    }

    // Pass 2: Check sequential step numbers (1..N)
    for (let i = 1; i <= STEP_DEFINITIONS.length; i++) {
      if (!stepNumbers.has(i)) {
        throw new Error(`STEP_DEFINITIONS: Missing step number ${i} (expected 1..${STEP_DEFINITIONS.length})`);
      }
    }

    // Pass 3: Check all dependsOn references exist
    for (const [stepKey, , , dependsOn] of STEP_DEFINITIONS) {
      for (const dep of dependsOn) {
        if (!keys.has(dep)) {
          throw new Error(`STEP_DEFINITIONS: Step "${stepKey}" depends on unknown step "${dep}"`);
        }
      }
    }

    // Pass 4: Kahn's algorithm — detect cycles
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    for (const [stepKey] of STEP_DEFINITIONS) {
      inDegree.set(stepKey, 0);
      adjacency.set(stepKey, []);
    }
    for (const [stepKey, , , dependsOn] of STEP_DEFINITIONS) {
      inDegree.set(stepKey, dependsOn.length);
      for (const dep of dependsOn) {
        adjacency.get(dep)!.push(stepKey);
      }
    }

    const queue: string[] = [];
    for (const [key, degree] of inDegree) {
      if (degree === 0) queue.push(key);
    }

    let visited = 0;
    while (queue.length > 0) {
      const node = queue.shift()!;
      visited++;
      for (const dependent of adjacency.get(node)!) {
        const newDegree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) queue.push(dependent);
      }
    }

    if (visited !== STEP_DEFINITIONS.length) {
      const cycleNodes = [...inDegree.entries()]
        .filter(([, degree]) => degree > 0)
        .map(([key]) => key);
      throw new Error(
        `STEP_DEFINITIONS: Circular dependency detected involving: ${cycleNodes.join(', ')}`,
      );
    }

    this.logger.log(`STEP_DEFINITIONS validated: ${STEP_DEFINITIONS.length} steps, DAG is acyclic`);
  }

  async createRun(projectId: string, organizationId: string, targetKey?: string | null) {
    return this.db.db.transaction(async (tx) => {
      // Create the run
      const [run] = await tx
        .insert(workflowRuns)
        .values({ projectId, organizationId, status: 'draft', targetKey: targetKey ?? null })
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
            artifacts: {
                // Fetch only the latest artifact version per step.  Loading all
                // versions on every getRun() call causes unbounded payload growth
                // as users revise steps.  The frontend uses artifacts[0] for
                // rendering; the version number field on that row still shows the
                // true revision count accurately.
                orderBy: (a, { desc }) => [desc(a.version)],
                limit: 1,
              },
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
    // Pre-flight: verify the org has enough credits for at least the first step
    const run = await this.db.db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, runId),
    });
    if (!run) throw new NotFoundException('Workflow run not found');

    const allAgents = this.agentRegistry.getAllAgents();
    // Only count agents that are actual workflow steps — business-profile is a project
    // attribute seeded into context at run start, not a workflow step, so it should not
    // be included in the credit pre-flight check.
    const workflowStepKeys = new Set(STEP_DEFINITIONS.map(([key]) => key));
    const totalCost = allAgents
      .filter((a) => workflowStepKeys.has(a.stepKey))
      .reduce((sum, a) => sum + a.creditCost, 0);
    const balance = await this.creditsService.getBalance(run.organizationId);
    if (balance < totalCost) {
      throw new BadRequestException(
        `Insufficient credits: workflow requires ${totalCost} credits but your balance is ${balance}. Add credits before starting.`,
      );
    }

    // Load and validate project BEFORE marking the run as running.
    // If any validation fails the run stays in 'draft' and is fully retryable.
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, run.projectId),
    });
    if (!project) {
      throw new NotFoundException(`Project not found for workflow run ${runId}`);
    }

    if (!project.businessProfile) {
      throw new BadRequestException(
        'No business profile found. Run the Business Profile analysis from the project overview before starting a workflow.',
      );
    }

    // Business profile freshness check.
    // businessProfileUpdatedAt is NULL for projects that pre-date the column —
    // skip the check in that case so legacy projects are not incorrectly blocked.
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (project.businessProfileUpdatedAt) {
      const ageMs = Date.now() - project.businessProfileUpdatedAt.getTime();
      if (ageMs > THIRTY_DAYS_MS) {
        const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        throw new BadRequestException(
          `Business profile is ${days} days old. Please refresh it from the project overview ` +
            `before starting a new workflow run so the AI analysis reflects your current business context.`,
        );
      }
    }

    // All validations passed — now atomically mark the run as running.
    const [updated] = await this.db.db
      .update(workflowRuns)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowRuns.id, runId))
      .returning();

    if (!updated) throw new NotFoundException('Workflow run not found');

    // Inject project-level context for prompt interpolation
    await this.setContext(runId, 'domain', project.domain);
    await this.setContext(runId, 'country', project.country);
    await this.setContext(runId, 'language', project.language);
    await this.setContext(runId, 'industry', project.industry ?? '');
    await this.setContext(runId, 'business-profile', project.businessProfile);

    // Enqueue the first step(s) — those with no dependencies
    const enqueued = await this.enqueuePendingSteps(runId);

    // If nothing was enqueued (e.g. Redis/BullMQ temporarily unavailable), roll the
    // run back to 'draft' so the user can retry cleanly without ending up with a
    // run that is forever stuck in 'running' with all steps 'pending'.
    if (enqueued.length === 0) {
      await this.db.db
        .update(workflowRuns)
        .set({ status: 'draft', startedAt: null, updatedAt: new Date() })
        .where(eq(workflowRuns.id, runId));
      throw new InternalServerErrorException(
        'Failed to start workflow: job queue is temporarily unavailable. Please try again in a moment.',
      );
    }

    return updated;
  }

  /**
   * Resume a stuck running workflow by re-enqueuing eligible pending steps.
   * Also resets steps that have been stuck in 'running' for > 35 minutes —
   * these are orphaned jobs where the BullMQ worker crashed or was never
   * picked up, leaving the step stranded with no active job behind it.
   */
  async resumeRun(runId: string) {
    const run = await this.db.db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, runId),
    });
    if (!run) throw new NotFoundException('Workflow run not found');
    if (run.status !== 'running') {
      throw new Error(`Cannot resume run in status: ${run.status}`);
    }

    // Reset steps that have been 'running' for more than 35 minutes.
    // The processor has a 30-minute wall-clock abort, so anything beyond that
    // is an orphaned job (server crash, BullMQ worker restart, etc.).
    const STALE_THRESHOLD_MS = 35 * 60 * 1000;
    const allSteps = await this.db.db.query.workflowSteps.findMany({
      where: eq(workflowSteps.workflowRunId, runId),
    });
    const staleKeys = allSteps
      .filter((s) => {
        if (s.status !== 'running') return false;
        if (!s.startedAt) return true; // no startedAt → definitely orphaned
        return Date.now() - s.startedAt.getTime() > STALE_THRESHOLD_MS;
      })
      .map((s) => s.stepKey);

    if (staleKeys.length > 0) {
      this.logger.warn(`resumeRun ${runId}: resetting ${staleKeys.length} stale running step(s) to pending: [${staleKeys.join(', ')}]`);
      await this.db.db
        .update(workflowSteps)
        .set({ status: 'pending', startedAt: null, error: null, updatedAt: new Date() })
        .where(and(eq(workflowSteps.workflowRunId, runId), inArray(workflowSteps.stepKey, staleKeys)));
    }

    const enqueued = await this.enqueuePendingSteps(runId);
    this.logger.log(`Resumed run ${runId}, enqueued: [${enqueued.join(', ')}]`);
    return { enqueued };
  }

  /**
   * Find steps whose dependencies are all completed/approved and enqueue them.
   * Uses a transaction to prevent race conditions on dependency reads.
   * Returns the step keys that were enqueued.
   *
   * Redis distributed lock: prevents two concurrent completions (e.g. competitor-metrics
   * and search-demand finishing within milliseconds of each other) from both reading
   * phase1-baseline as 'pending' and double-enqueuing it. The lock is per-run so
   * parallel runs never block each other.
   */
  async enqueuePendingSteps(workflowRunId: string): Promise<string[]> {
    // Acquire a per-run Redis lock. If another fiber already holds it for this run,
    // skip — they are already handling the enqueue and will pick up any newly-eligible steps.
    const lockKey = `wf:enq:${workflowRunId}`;
    const lockVal = `${Date.now()}-${Math.random()}`;
    const LOCK_TTL_MS = 5000; // generous: DB transaction completes well under 1 s

    const redisClient = await (this.workflowQueue as any).client as {
      set(key: string, val: string, mode: string, ttl: number, flag: string): Promise<string | null>;
      get(key: string): Promise<string | null>;
      del(key: string): Promise<number>;
    };

    const acquired = await redisClient.set(lockKey, lockVal, 'PX', LOCK_TTL_MS, 'NX');
    if (!acquired) {
      this.logger.debug(`enqueuePendingSteps: lock busy for run ${workflowRunId.slice(0, 8)} — skipping concurrent call`);
      return [];
    }

    try {
      return await this._doEnqueuePendingSteps(workflowRunId);
    } finally {
      // Release lock only if we still own it (TTL may have expired on a very slow transaction)
      try {
        const current = await redisClient.get(lockKey);
        if (current === lockVal) await redisClient.del(lockKey);
      } catch {
        // Best-effort lock release — TTL will clean it up automatically
      }
    }
  }

  /** Inner implementation — called only after the Redis lock is held. */
  private async _doEnqueuePendingSteps(workflowRunId: string): Promise<string[]> {
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

    // Enqueue BullMQ jobs outside the transaction (after commit).
    // If any enqueue fails, rollback those steps to 'pending' so they can be retried.
    const enqueueFailures: string[] = [];
    for (const stepKey of enqueued) {
      try {
        await this.workflowQueue.add('execute-step', {
          workflowRunId,
          stepKey,
          organizationId: run.organizationId,
        }, {
            jobId: `${workflowRunId}__${stepKey}__${Date.now()}`,
        });
      } catch (error) {
        this.logger.error(`Failed to enqueue step ${stepKey}: ${error}`);
        enqueueFailures.push(stepKey);
      }
    }

    // Rollback orphaned steps that failed to enqueue
    if (enqueueFailures.length > 0) {
      await this.db.db
        .update(workflowSteps)
        .set({ status: 'pending', startedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(workflowSteps.workflowRunId, workflowRunId),
            inArray(workflowSteps.stepKey, enqueueFailures),
          ),
        );
      this.logger.warn(`Rolled back ${enqueueFailures.length} steps to pending after enqueue failure`);
    }

    const successfullyEnqueued = enqueued.filter((k) => !enqueueFailures.includes(k));
    this.logger.log(`Enqueued steps for run ${workflowRunId}: [${successfullyEnqueued.join(', ')}]`);

    // If nothing was enqueued, check whether all steps are terminal (no pending/running left).
    // If so, mark the workflow run itself as completed.
    if (successfullyEnqueued.length === 0) {
      const allSteps = await this.db.db.query.workflowSteps.findMany({
        where: eq(workflowSteps.workflowRunId, workflowRunId),
        columns: { status: true },
      });
      const hasActive = allSteps.some(
        (s) => s.status === 'pending' || s.status === 'running',
      );
      if (!hasActive && allSteps.length > 0) {
        await this.db.db
          .update(workflowRuns)
          .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
          .where(eq(workflowRuns.id, workflowRunId));
        this.logger.log(`Workflow run ${workflowRunId} marked as completed`);
      }
    }

    return successfullyEnqueued;
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

  /**
   * Re-run a step and cascade-reset all non-approved downstream dependents.
   * Only allowed when the step is NOT approved, pending, or running.
   */
  async rerunStep(workflowRunId: string, stepKey: string) {
    const step = await this.db.db.query.workflowSteps.findFirst({
      where: and(
        eq(workflowSteps.workflowRunId, workflowRunId),
        eq(workflowSteps.stepKey, stepKey),
      ),
    });
    if (!step) throw new NotFoundException('Step not found');

    const NON_RERUNNABLE: string[] = ['approved', 'pending', 'running'];
    if (NON_RERUNNABLE.includes(step.status)) {
      throw new BadRequestException(
        `Cannot re-run step in status: ${step.status}`,
      );
    }

    // Find all transitive downstream steps
    const downstream = this.getDownstreamSteps(stepKey);

    // Collect all step keys to reset (target + non-approved downstream)
    const allKeysToReset = [stepKey, ...downstream];

    const cascadeReset: string[] = [];

    await this.db.db.transaction(async (tx) => {
      // Get current status of all steps in one query
      const steps = await tx.query.workflowSteps.findMany({
        where: eq(workflowSteps.workflowRunId, workflowRunId),
      });
      const statusByKey = new Map(steps.map((s) => [s.stepKey, s.status]));

      for (const key of allKeysToReset) {
        const currentStatus = statusByKey.get(key);
        // Skip approved steps (immutable) and already-pending steps
        if (currentStatus === 'approved' || currentStatus === 'pending') continue;

        await tx
          .update(workflowSteps)
          .set({
            status: 'pending',
            startedAt: null,
            completedAt: null,
            error: null,
            iterations: 0,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workflowSteps.workflowRunId, workflowRunId),
              eq(workflowSteps.stepKey, key),
            ),
          );

        // Clear stale context for this step
        await tx
          .delete(workflowContext)
          .where(
            and(
              eq(workflowContext.workflowRunId, workflowRunId),
              eq(workflowContext.key, key),
            ),
          );

        if (key !== stepKey) cascadeReset.push(key);
      }
    });

    // Enqueue pending steps whose dependencies are met (will pick up the reset target)
    await this.enqueuePendingSteps(workflowRunId);

    this.logger.log(
      `Re-run step ${stepKey} (run: ${workflowRunId}), cascade reset: [${cascadeReset.join(', ')}]`,
    );

    return { rerun: stepKey, cascadeReset };
  }

  async getStepToolCalls(stepId: string) {
    return this.db.db
      .select()
      .from(stepToolCalls)
      .where(eq(stepToolCalls.workflowStepId, stepId))
      .orderBy(asc(stepToolCalls.createdAt));
  }

  /**
   * Walk the STEP_DEFINITIONS DAG to find all transitive downstream dependents of a step.
   */
  private getDownstreamSteps(stepKey: string): string[] {
    // Build adjacency: step → direct dependents
    const dependents = new Map<string, string[]>();
    for (const [key] of STEP_DEFINITIONS) {
      dependents.set(key, []);
    }
    for (const [key, , , deps] of STEP_DEFINITIONS) {
      for (const dep of deps) {
        dependents.get(dep)?.push(key);
      }
    }

    // BFS from stepKey
    const visited = new Set<string>();
    const queue = [...(dependents.get(stepKey) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const child of dependents.get(current) ?? []) {
        queue.push(child);
      }
    }

    return [...visited];
  }

  /**
   * Update the latest artifact data for a step (merge partial update).
   * Only allowed when step is awaiting_approval or completed.
   */
  async updateArtifact(
    workflowRunId: string,
    stepKey: string,
    partialData: Record<string, unknown>,
  ) {
    const run = await this.getRun(workflowRunId);
    const step = run.steps.find((s) => s.stepKey === stepKey);
    if (!step) throw new NotFoundException(`Step "${stepKey}" not found in run ${workflowRunId}`);

    if (step.status !== 'awaiting_approval' && step.status !== 'completed') {
      throw new BadRequestException(
        `Cannot edit artifact: step is in "${step.status}" status. Must be awaiting_approval or completed.`,
      );
    }

    const latest = step.artifacts?.[0];
    if (!latest) throw new NotFoundException(`No artifact found for step "${stepKey}"`);

    // Merge new data into existing data
    const existingData = (latest.data ?? {}) as Record<string, unknown>;
    const mergedData = { ...existingData, ...partialData };

    // Create a new version with merged data
    const newVersion = latest.version + 1;
    const [inserted] = await this.db.db
      .insert(stepArtifacts)
      .values({
        workflowStepId: step.id,
        workflowRunId,
        stepKey,
        version: newVersion,
        data: mergedData,
        reasoning: latest.reasoning,
      })
      .returning();

    this.logger.log(`Updated artifact for step "${stepKey}" (v${newVersion})`);
    return { id: inserted.id, version: newVersion };
  }

  /**
   * Delete a workflow run and all its cascaded records (steps, artifacts,
   * tool-calls, approvals, context). Keywords / topical maps / content /
   * reports that reference this run have their workflowRunId set to NULL
   * (SET NULL FK) — they are not deleted.
   */
  async deleteRun(runId: string) {
    const run = await this.db.db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, runId),
    });
    if (!run) throw new NotFoundException('Workflow run not found');

    await this.db.db.delete(workflowRuns).where(eq(workflowRuns.id, runId));
    this.logger.log(`Deleted workflow run ${runId}`);
    return { deleted: runId };
  }
}
