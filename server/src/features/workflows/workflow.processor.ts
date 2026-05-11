import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { PromptService } from '../../shared/prompt/prompt.service';
import { AgentRuntime } from '../../agents/agent.runtime';
import { AgentRegistry } from '../../agents/agent.registry';
import { OutputValidator } from '../../agents/output.validator';
import { CreditsService } from '../credits/credits.service';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';
import {
  workflowSteps,
  stepArtifacts,
  stepToolCalls,
  workflowRuns,
} from '../../db/schema';

interface StepJobData {
  workflowRunId: string;
  stepKey: string;
  organizationId: string;
}

@Processor('workflow-steps')
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly promptService: PromptService,
    private readonly agentRuntime: AgentRuntime,
    private readonly agentRegistry: AgentRegistry,
    private readonly outputValidator: OutputValidator,
    private readonly creditsService: CreditsService,
    private readonly workflowService: WorkflowService,
    private readonly workflowGateway: WorkflowGateway,
  ) {
    super();
  }

  async process(job: Job<StepJobData>): Promise<void> {
    const { workflowRunId, stepKey, organizationId } = job.data;
    this.logger.log(`Processing step: ${stepKey} (run: ${workflowRunId})`);

    try {
      // 1. Load agent definition
      const agentDef = this.agentRegistry.getAgent(stepKey);
      if (!agentDef) {
        throw new Error(`No agent definition found for step: ${stepKey}`);
      }

      // 2. Debit credits BEFORE execution (fail fast if insufficient)
      await this.creditsService.debit({
        organizationId,
        amount: agentDef.creditCost,
        description: `Step: ${stepKey}`,
        workflowRunId,
        stepKey,
      });

      // 3. Emit step started
      this.workflowGateway.emitStepStarted(workflowRunId, stepKey);

      // 4. Load prompts
      const promptPath = this.getPromptPath(stepKey);
      const context = await this.workflowService.getContext(workflowRunId);
      const prompt = await this.promptService.loadPrompt(promptPath, context);

      // 5. Execute agent
      const result = await this.agentRuntime.execute({
        name: agentDef.name,
        model: agentDef.model,
        temperature: agentDef.temperature,
        maxIterations: agentDef.maxIterations,
        tools: agentDef.tools,
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
      });

      // 5.5. Validate output against schema (if defined)
      if (agentDef.outputSchema) {
        const validation = this.outputValidator.validate(result.output, agentDef.outputSchema);
        if (!validation.valid) {
          this.logger.warn(
            `Output validation failed for ${stepKey}: ${validation.errors.join(', ')}`,
          );
        }
      }

      // 6. Get the step record
      const step = await this.db.db.query.workflowSteps.findFirst({
        where: and(
          eq(workflowSteps.workflowRunId, workflowRunId),
          eq(workflowSteps.stepKey, stepKey),
        ),
      });

      if (!step) throw new Error(`Step record not found: ${stepKey}`);

      // 7-12. Persist artifacts and update status in a transaction
      await this.db.db.transaction(async (tx) => {
        // 7. Compute next artifact version
        const latestArtifact = await tx.query.stepArtifacts.findFirst({
          where: and(
            eq(stepArtifacts.workflowRunId, workflowRunId),
            eq(stepArtifacts.stepKey, stepKey),
          ),
          orderBy: desc(stepArtifacts.version),
          columns: { version: true },
        });
        const nextVersion = (latestArtifact?.version ?? 0) + 1;

        // 8. Persist artifact
        await tx.insert(stepArtifacts).values({
          workflowStepId: step.id,
          workflowRunId,
          stepKey,
          version: nextVersion,
          data: result.output ?? {},
          reasoning: result.reasoning,
        });

        // 9. Persist tool calls
        if (result.toolCalls.length > 0) {
          await tx.insert(stepToolCalls).values(
            result.toolCalls.map((tc) => ({
              workflowStepId: step.id,
              toolName: tc.toolName,
              input: tc.input ?? {},
              output: tc.output ?? null,
              durationMs: tc.durationMs,
              error: tc.success ? null : String(tc.output),
            })),
          );
        }

        // 11. Update step status
        const newStatus = agentDef.requiresApproval ? 'awaiting_approval' : 'completed';
        await tx
          .update(workflowSteps)
          .set({
            status: newStatus,
            completedAt: new Date(),
            creditsUsed: agentDef.creditCost,
            iterations: result.iterations,
            updatedAt: new Date(),
          })
          .where(eq(workflowSteps.id, step.id));

        // 12. Update run progress
        await tx
          .update(workflowRuns)
          .set({
            creditsUsed: sql`${workflowRuns.creditsUsed} + ${agentDef.creditCost}`,
            currentStep: stepKey,
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, workflowRunId));
      });

      // 10. Store artifact in workflow context for downstream steps
      await this.workflowService.setContext(workflowRunId, stepKey, result.output);

      // 13. Emit completion event
      const newStatus = agentDef.requiresApproval ? 'awaiting_approval' : 'completed';
      this.workflowGateway.emitStepCompleted(workflowRunId, stepKey, newStatus);

      // 14. Enqueue downstream steps if auto-approved
      if (!agentDef.requiresApproval) {
        await this.workflowService.enqueuePendingSteps(workflowRunId);
      }

      this.logger.log(`Step ${stepKey} completed (status: ${newStatus})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step ${stepKey} failed: ${message}`);

      // Emit error event
      this.workflowGateway.emitStepError(workflowRunId, stepKey, message);

      // Mark step as failed
      await this.db.db
        .update(workflowSteps)
        .set({ status: 'failed', error: message, updatedAt: new Date() })
        .where(
          and(
            eq(workflowSteps.workflowRunId, workflowRunId),
            eq(workflowSteps.stepKey, stepKey),
          ),
        );
    }
  }

  private getPromptPath(stepKey: string): string {
    const stepPromptMap: Record<string, string> = {
      'business-profile': 'discovery/business-profile.prompt.md',
      'seed-keywords': 'discovery/seed-keywords.prompt.md',
      'site-audit': 'audit/site-audit.prompt.md',
      'ai-intelligence': 'intelligence/ai-intelligence.prompt.md',
      'serp-niche-map': 'discovery/serp-niche-map.prompt.md',
      'competitor-buckets': 'competitors/competitor-buckets.prompt.md',
      'competitor-metrics': 'competitors/competitor-metrics.prompt.md',
      'search-demand': 'intelligence/search-demand.prompt.md',
      'phase1-baseline': 'research/phase1-baseline.prompt.md',
      'method01-competitor-pages': 'research/method01-competitor-pages.prompt.md',
      'method02-seed-expansion': 'research/method02-seed-expansion.prompt.md',
      'method03-content-gap-import': 'research/method03-content-gap-import.prompt.md',
      'consolidated-keywords': 'research/consolidation.prompt.md',
      'verdict-strategy': 'strategy/verdict-strategy.prompt.md',
      'topical-map': 'topical-map/topical-map.prompt.md',
      'content-brief': 'content/content-brief.prompt.md',
      'content-article': 'articles/content-article.prompt.md',
    };

    return stepPromptMap[stepKey] ?? `${stepKey}.prompt.md`;
  }
}
