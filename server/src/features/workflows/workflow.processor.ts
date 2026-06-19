import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { PromptService } from '../../shared/prompt/prompt.service';
import { AgentRuntime } from '../../agents/agent.runtime';
import { AgentRegistry } from '../../agents/agent.registry';
import { OutputValidator } from '../../agents/output.validator';
import { VerificationService } from '../../shared/verification/verification.service';
import { PipelineService } from './pipelines/pipeline.service';
import { SkillService } from '../../agents/skill.service';
import { CreditsService } from '../credits/credits.service';
import { WorkflowService, STEP_DEFINITIONS } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowMaterializerService } from './workflow-materializer.service';
import { DlqService } from './dlq.service';
import { ProjectIntelligenceService } from '../projects/project-intelligence.service';
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

// maxStalledCount: 0 — disables BullMQ's stalled-job auto-retry. Recovery from server
// restarts is handled exclusively by WorkflowService.reconcileOrphanedRuns() on boot,
// which resets orphaned steps to 'pending' and re-enqueues them. Allowing BullMQ to
// also retry stalled jobs would cause double execution of the same step.
@Processor('workflow-steps', { maxStalledCount: 0 })
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly promptService: PromptService,
    private readonly agentRuntime: AgentRuntime,
    private readonly agentRegistry: AgentRegistry,
    private readonly outputValidator: OutputValidator,
    private readonly verificationService: VerificationService,
    private readonly pipelineService: PipelineService,
    private readonly creditsService: CreditsService,
    private readonly workflowService: WorkflowService,
    private readonly workflowGateway: WorkflowGateway,
    private readonly materializer: WorkflowMaterializerService,
    private readonly dlqService: DlqService,
    private readonly skillService: SkillService,
    private readonly intelligenceService: ProjectIntelligenceService,
  ) {
    super();
  }

  /** Wall-clock limit per step — aborts the Anthropic SDK call if the step hangs. */
  private static readonly STEP_TIMEOUT_MS = 30 * 60 * 1000;

  async process(job: Job<StepJobData>): Promise<void> {
    const { workflowRunId, stepKey, organizationId } = job.data;
    this.logger.log(`Processing step: ${stepKey} (run: ${workflowRunId})`);

    const abortController = new AbortController();
    const abortTimer = setTimeout(() => {
      this.logger.error(`Step ${stepKey} exceeded 30-minute wall-clock timeout — aborting Anthropic call`);
      abortController.abort(new Error(`Step ${stepKey} timed out after 30 minutes`));
    }, WorkflowProcessor.STEP_TIMEOUT_MS);

    try {
      // 1. Load agent definition
      const agentDef = this.agentRegistry.getAgent(stepKey);
      if (!agentDef) {
        throw new Error(`No agent definition found for step: ${stepKey}`);
      }

      // 2. Pre-check credit balance (fail fast if insufficient, but don't debit yet)
      const hasCredits = await this.creditsService.hasCredits(organizationId, agentDef.creditCost);
      if (!hasCredits) {
        throw new Error(`Insufficient credits for step: ${stepKey} (requires ${agentDef.creditCost})`);
      }

      // 3. Emit step started
      this.workflowGateway.emitStepStarted(workflowRunId, stepKey);

      // Resolve execution type (V7 executionType with backward-compat fallback to tier)
      const executionType =
        agentDef.executionType ??
        (agentDef.tier === 'tier1' ? 'pipeline-only' : agentDef.tier === 'tier2' ? 'agent-only' : 'agent-with-tools');

      // 3.5. pipeline-only fast-path: direct pipeline execution (no LLM)
      if (executionType === 'pipeline-only') {
        const context = await this.workflowService.getContext(workflowRunId);
        const transformedContext = this.transformContextForStep(stepKey, context);
        const pipelineOutput = await this.pipelineService.execute(stepKey, transformedContext);

        // Persist artifact directly
        const step = await this.db.db.query.workflowSteps.findFirst({
          where: and(
            eq(workflowSteps.workflowRunId, workflowRunId),
            eq(workflowSteps.stepKey, stepKey),
          ),
        });
        if (!step) throw new Error(`Step record not found: ${stepKey}`);

        await this.db.db.transaction(async (tx) => {
          const existing = await tx.query.stepArtifacts.findFirst({
            where: and(eq(stepArtifacts.workflowStepId, step.id), eq(stepArtifacts.stepKey, stepKey)),
            orderBy: [desc(stepArtifacts.version)],
          });
          const nextVersion = (existing?.version ?? 0) + 1;

          await tx.insert(stepArtifacts).values({
            workflowStepId: step.id,
            workflowRunId,
            stepKey,
            version: nextVersion,
            data: pipelineOutput ?? {},
            reasoning: null,
            metadata: { provider: 'pipeline', model: 'none', tokensUsed: { input: 0, output: 0, total: 0 }, iterations: 0 },
          });

          const finalStatus = agentDef.requiresApproval ? 'awaiting_approval' : 'completed';
          await tx.update(workflowSteps).set({ status: finalStatus, completedAt: new Date() }).where(eq(workflowSteps.id, step.id));

          // Debit credits inside transaction (atomic with artifact persistence)
          if (agentDef.creditCost > 0) {
            await this.creditsService.debit({
              organizationId,
              amount: agentDef.creditCost,
              description: `Pipeline: ${stepKey}`,
              workflowRunId,
              stepKey,
            }, tx);
          }
        });

        const pipelineFinalStatus = agentDef.requiresApproval ? 'awaiting_approval' : 'completed';
        this.workflowGateway.emitStepCompleted(workflowRunId, stepKey, pipelineFinalStatus);
        await this.materializer.materialize(workflowRunId, stepKey);

        // Store pipeline output in workflow context so downstream steps can read it
        if (pipelineOutput != null) {
          await this.workflowService.setContext(workflowRunId, stepKey, pipelineOutput);
        }

        // Enqueue downstream steps that are now unblocked (only if not awaiting approval)
        if (!agentDef.requiresApproval) {
          await this.workflowService.enqueuePendingSteps(workflowRunId);
        }
        return;
      }

      // 4. Load prompts
      const promptPath = this.getPromptPath(stepKey);
      const context = await this.workflowService.getContext(workflowRunId);
      const transformedContext = this.transformContextForStep(stepKey, context);
      const prompt = await this.promptService.loadPrompt(promptPath, transformedContext);

      // 5. Execute based on executionType
      const MAX_VERIFICATION_RETRIES = 2;
      let result: { output: unknown; reasoning: string | null; toolCalls: Array<{ toolName: string; input: unknown; output: unknown; durationMs: number; success: boolean }>; totalTokens: number; iterations: number; thinkingContent?: string | null };

      // Load skill content for all agent execution types
      const skillContent = agentDef.skill ? await this.skillService.loadSkill(agentDef.skill) : null;

      // Track pipeline output at outer scope so verification retries can re-use it
      let pipelineOutput: unknown = undefined;

      // Load workflow run for projectId + targetKey (needed by AgentRuntime + PIS)
      const run = await this.db.db.query.workflowRuns.findFirst({
        where: eq(workflowRuns.id, workflowRunId),
      });
      if (!run) throw new Error(`Workflow run not found: ${workflowRunId}`);

      // Assemble project intelligence context
      const pisContext = await this.intelligenceService.assembleContext({
        projectId: run.projectId,
        organizationId,
        targetKey: run.targetKey ?? null,
      });
      const intelligenceXml = this.intelligenceService.renderContextXml(pisContext);

      // Context key slicing for late-stage steps: only include the upstream outputs each
      // step actually reads. Full context at these steps is 80–100K tokens; slicing to the
      // required keys reduces input cost without changing output quality.
      // When a step is not listed here, the full workflowContext is passed (backwards-compatible).
      const STEP_CONTEXT_KEYS: Record<string, string[]> = {
        // method03 gets dedup data via prompt template variables ({{phase1-baseline.currentRankings}} etc.)
        // Sending it again in <workflow_context> doubles input tokens and causes the agent to
        // exhaust its 32K output budget on analysis text before calling return_output.
        'method03-content-gap-import': [],
        'consolidated-keywords': [
          'seed-keywords',
          'method01-competitor-pages',
          'method02-seed-expansion',
          'method03-content-gap-import',
          'phase1-baseline',
        ],
        'verdict-strategy': [
          'business-profile',
          'site-audit',
          'ai-intelligence',
          'competitor-buckets',
          'competitor-metrics',
          'consolidated-keywords',
        ],
        'topical-map': [
          // consolidated-keywords is already embedded in the prompt via template
          // variables — including it here duplicates ~150KB of input tokens.
          'verdict-strategy',
          'business-profile',
        ],
        // Content steps only need the topical plan and brand context — not all 14 upstream outputs.
        'content-brief': [
          'topical-map',
          'business-profile',
        ],
        'content-article': [
          'content-brief',
          'business-profile',
        ],
        // content-images only needs alt-text suggestions + brand context, not all upstream data.
        'content-images': [
          'content-article',
          'business-profile',
        ],
      };

      // Build common AgentRuntime config
      const baseRuntimeConfig = {
        stepKey,
        projectId: run.projectId,
        organizationId,
        targetKey: run.targetKey ?? null,
        workflowRunId,
        model: agentDef.model,
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        skillContent,
        intelligenceContext: intelligenceXml || undefined,
        workflowContext: transformedContext,
        contextKeys: STEP_CONTEXT_KEYS[stepKey],
        thinkingBudget: agentDef.thinkingBudget,
        maxIterations: agentDef.maxIterations,
        signal: abortController.signal,
      };

      if (executionType === 'pipeline-then-agent') {
        // Step 1: Run pipeline to fetch raw data
        pipelineOutput = await this.pipelineService.execute(stepKey, transformedContext);

        // Step 2: Run agent to reason over pipeline data (no tools)
        const agentResult = await this.agentRuntime.execute({
          ...baseRuntimeConfig,
          allowedTools: [],
          pipelineData: pipelineOutput,
        });

        if (agentResult.finishReason === 'error') {
          throw new Error(`Agent failed (pipeline-then-agent): ${agentResult.error}`);
        }

        result = {
          output: agentResult.output,
          reasoning: agentResult.reasoning,
          toolCalls: agentResult.toolCalls,
          totalTokens: agentResult.totalTokens.input + agentResult.totalTokens.output,
          iterations: agentResult.iterations,
          thinkingContent: agentResult.thinkingContent,
        };
      } else if (executionType === 'agent-only') {
        // Agent reasons over prior context only, no tools, no pipeline
        const agentResult = await this.agentRuntime.execute({
          ...baseRuntimeConfig,
          allowedTools: [],
        });

        if (agentResult.finishReason === 'error') {
          throw new Error(`Agent failed (agent-only): ${agentResult.error}`);
        }

        result = {
          output: agentResult.output,
          reasoning: agentResult.reasoning,
          toolCalls: agentResult.toolCalls,
          totalTokens: agentResult.totalTokens.input + agentResult.totalTokens.output,
          iterations: agentResult.iterations,
          thinkingContent: agentResult.thinkingContent,
        };
      } else {
        // agent-with-tools: AgentRuntime with full tool loop
        const agentResult = await this.agentRuntime.execute({
          ...baseRuntimeConfig,
          allowedTools: agentDef.tools,
        });

        if (agentResult.finishReason === 'error') {
          throw new Error(`Agent failed: ${agentResult.error}`);
        }

        result = {
          output: agentResult.output,
          reasoning: agentResult.reasoning,
          toolCalls: agentResult.toolCalls,
          totalTokens: agentResult.totalTokens.input + agentResult.totalTokens.output,
          iterations: agentResult.iterations,
          thinkingContent: agentResult.thinkingContent,
        };
      }

      // 5.5. Validate output against schema (if defined)
      if (agentDef.outputSchema) {
        const validation = this.outputValidator.validate(result.output, agentDef.outputSchema);
        if (!validation.valid) {
          const message = `Output validation failed for ${stepKey}: ${validation.errors.join(', ')}`;
          this.logger.warn(message);
          if (stepKey === 'content-brief') {
            throw new Error(message);
          }
        }
      }

      // 5.6. Verification rules (post-execution quality check)
      const verification = this.verificationService.verify(stepKey, result.output, transformedContext);
      if (!verification.valid) {
        this.logger.warn(`Verification failed for ${stepKey}: ${verification.errors.join('; ')}`);

        // Retry with feedback
        for (let retry = 0; retry < MAX_VERIFICATION_RETRIES; retry++) {
          this.logger.log(`Verification retry ${retry + 1}/${MAX_VERIFICATION_RETRIES} for ${stepKey}`);
          const feedback = `Your previous output failed verification:\n${verification.errors.join('\n')}\n\nPlease fix these issues and produce corrected output.`;

          // Retry uses same execution type via AgentRuntime with feedback appended
          const retryResult = await this.agentRuntime.execute({
            ...baseRuntimeConfig,
            allowedTools: executionType === 'agent-with-tools' ? agentDef.tools : [],
            userPrompt: `${prompt.user}\n\n<verification_feedback>\n${feedback}\n</verification_feedback>`,
            ...(executionType === 'pipeline-then-agent' ? { pipelineData: pipelineOutput } : {}),
          });
          if (retryResult.finishReason === 'error') {
            throw new Error(`Agent retry failed: ${retryResult.error}`);
          }
          result = {
            output: retryResult.output,
            reasoning: retryResult.reasoning,
            toolCalls: retryResult.toolCalls,
            totalTokens: retryResult.totalTokens.input + retryResult.totalTokens.output,
            iterations: retryResult.iterations,
            thinkingContent: retryResult.thinkingContent,
          };

          const retryVerification = this.verificationService.verify(stepKey, result.output, transformedContext);
          if (retryVerification.valid) break;

          if (retry === MAX_VERIFICATION_RETRIES - 1) {
            this.logger.error(`Verification still failing after ${MAX_VERIFICATION_RETRIES} retries for ${stepKey}`);
          }
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

      // 7-12. Persist artifacts, debit credits, and update status in a single transaction
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

        // 8. Persist artifact with execution metadata
        await tx.insert(stepArtifacts).values({
          workflowStepId: step.id,
          workflowRunId,
          stepKey,
          version: nextVersion,
          data: result.output ?? {},
          reasoning: result.reasoning,
          thinkingContent: result.thinkingContent ?? null,
          metadata: {
            provider: 'anthropic',
            model: agentDef.model,
            tokensUsed: result.totalTokens,
            iterations: result.iterations,
          },
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

        // 10. Debit credits AFTER successful execution (inside transaction with artifacts)
        await this.creditsService.debit({
          organizationId,
          amount: agentDef.creditCost,
          description: `Step: ${stepKey}`,
          workflowRunId,
          stepKey,
        }, tx);

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

      // 10b. Store artifact in workflow context for downstream steps.
      // For content-images, strip raw base64 blobs before persisting — the binary
      // data is materialized into the content_images table by WorkflowMaterializerService.
      // Storing 15–30 MB of base64 in workflow_context/JSONB is unnecessary and slow.
      if (result.output != null) {
        const contextValue =
          stepKey === 'content-images'
            ? this.stripImagesBase64(result.output)
            : result.output;
        await this.workflowService.setContext(workflowRunId, stepKey, contextValue);
      }

      // 13. Emit completion event
      const newStatus = agentDef.requiresApproval ? 'awaiting_approval' : 'completed';
      this.workflowGateway.emitStepCompleted(workflowRunId, stepKey, newStatus);

      // 14. Enqueue downstream steps if auto-approved
      if (!agentDef.requiresApproval) {
        // Materialize auto-approved steps into project feature tables
        await this.materializer.materialize(workflowRunId, stepKey);
        await this.workflowService.enqueuePendingSteps(workflowRunId);
      }

      this.logger.log(`Step ${stepKey} completed (status: ${newStatus})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step ${stepKey} failed: ${message}`);

      // Emit error event
      this.workflowGateway.emitStepError(workflowRunId, stepKey, message);

      // Capture into DLQ on final attempt (BullMQ default: 3 attempts)
      const maxAttempts = job.opts?.attempts ?? 3;
      const isFinalAttempt = job.attemptsMade >= maxAttempts;

      if (isFinalAttempt) {
        await this.dlqService.captureFailedJob({
          workflowStepId: undefined,
          workflowRunId,
          stepKey,
          error: message,
          attemptCount: job.attemptsMade,
          jobData: job.data as unknown as Record<string, unknown>,
        });
      }

      // Only mark the step as 'failed' on the FINAL BullMQ retry attempt.
      // During earlier retries the step remains 'running' in the DB, which prevents
      // the frontend from showing a false-positive "stuck" banner while BullMQ is
      // still actively retrying the job.
      if (isFinalAttempt) {
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

      // On final attempt: check if the run is now unrecoverable (no pending steps
      // can ever become runnable because they all transitively depend on this failed step).
      // If so, mark the run as failed so it doesn't stay stuck in 'running'.
      if (isFinalAttempt) {
        try {
          const allSteps = await this.db.db.query.workflowSteps.findMany({
            where: eq(workflowSteps.workflowRunId, workflowRunId),
          });
          const statusByKey = new Map(allSteps.map((s) => [s.stepKey, s.status]));

          // A step is "blocked" if it or any of its ancestors is failed
          const isBlocked = (key: string, visited = new Set<string>()): boolean => {
            if (visited.has(key)) return false;
            visited.add(key);
            const status = statusByKey.get(key);
            if (status === 'failed') return true;
            const def = STEP_DEFINITIONS.find(([k]) => k === key);
            if (!def) return false;
            return def[3].some((dep) => isBlocked(dep, visited));
          };

          const anyPendingCanRun = STEP_DEFINITIONS.some(([k, , , deps]) => {
            const status = statusByKey.get(k);
            if (status !== 'pending' && status !== 'running') return false;
            return !isBlocked(k, new Set());
          });

          if (!anyPendingCanRun) {
            this.logger.error(`Run ${workflowRunId} is unrecoverable after step ${stepKey} failed — marking run as failed`);
            await this.db.db
              .update(workflowRuns)
              .set({ status: 'failed', completedAt: new Date(), updatedAt: new Date() })
              .where(eq(workflowRuns.id, workflowRunId));
            this.workflowGateway.emitWorkflowCompleted(workflowRunId);
          }
        } catch (checkErr) {
          this.logger.warn(`Failed to check run recoverability: ${(checkErr as Error).message}`);
        }
      }

      // Re-throw so BullMQ triggers retry attempts
      throw error;
    } finally {
      clearTimeout(abortTimer);
    }
  }

  /**
   * Apply per-step context transformations before prompt interpolation.
   * Currently filters competitor-branded keywords out of the topical-map step
   * so the content plan only includes keywords the target domain can own.
   */
  private transformContextForStep(
    stepKey: string,
    context: Record<string, unknown>,
  ): Record<string, unknown> {
    if (stepKey !== 'topical-map') return context;

    const competitorBrands = this.extractCompetitorBrands(context);

    const targetDomain = String(context['domain'] ?? '').toLowerCase();
    const targetBrand = targetDomain.replace(/\.[^.]+$/, '').toLowerCase();

    // Remove target brand from the filter list so own-brand keywords pass through
    const brandsToFilter = competitorBrands.filter(
      (b) => b !== targetBrand && !targetBrand.includes(b),
    );

    // Deep-clone consolidated keywords for transformation
    const consolidated = context['consolidated-keywords'] as
      | { keywords?: Array<{ keyword: string; volume?: number; difficulty?: number; intent?: string; funnelStage?: string; opportunityScore?: number; source?: string; [k: string]: unknown }> ; [k: string]: unknown }
      | undefined;

    if (!consolidated?.keywords?.length) {
      return brandsToFilter.length > 0
        ? { ...context, 'competitor-brands': brandsToFilter }
        : context;
    }

    // 1. Filter competitor-branded keywords
    let keywords = consolidated.keywords;
    if (brandsToFilter.length > 0) {
      keywords = keywords.filter((kw) => {
        const lower = kw.keyword.toLowerCase();
        return !brandsToFilter.some((brand) => lower.includes(brand));
      });
      const removed = consolidated.keywords.length - keywords.length;
      if (removed > 0) {
        this.logger.log(
          `Topical-map brand filter: ${consolidated.keywords.length} → ${keywords.length} keywords (removed ${removed} competitor-branded)`,
        );
      }
    }

    // 2. Trim to top 200 keywords (prompt says "Every keyword from top 200") — saves ~30K+ tokens
    const TOP_N = 200;
    if (keywords.length > TOP_N) {
      this.logger.log(`Topical-map keyword cap: ${keywords.length} → ${TOP_N} (already sorted by opportunityScore)`);
      keywords = keywords.slice(0, TOP_N);
    }

    // 3. Slim keyword objects — strip fields the topical-map agent doesn't need
    const slimKeywords = keywords.map((kw) => ({
      keyword: kw.keyword,
      volume: kw.volume ?? 0,
      difficulty: kw.difficulty ?? 0,
      intent: kw.intent ?? 'informational',
      funnelStage: kw.funnelStage ?? 'TOFU',
      opportunityScore: kw.opportunityScore ?? 0,
    }));

    return {
      ...context,
      'consolidated-keywords': { ...consolidated, keywords: slimKeywords },
      ...(brandsToFilter.length > 0 ? { 'competitor-brands': brandsToFilter } : {}),
    };
  }

  /**
   * Extract competitor brand names from both competitor-metrics domains
   * and competitor-buckets labels. Strips TLDs and filters out brands
   * shorter than 4 characters to avoid false positives.
   */
  private extractCompetitorBrands(context: Record<string, unknown>): string[] {
    const brands = new Set<string>();
    const MIN_BRAND_LENGTH = 4;

    // Source 1: competitor-metrics → competitorMetrics[].domain
    const metrics = context['competitor-metrics'] as
      | { competitorMetrics?: Array<{ domain?: string }> }
      | undefined;
    if (metrics?.competitorMetrics) {
      for (const c of metrics.competitorMetrics) {
        if (c.domain) {
          const brand = c.domain.toLowerCase().replace(/\.[^.]+$/, '');
          if (brand.length >= MIN_BRAND_LENGTH) brands.add(brand);
        }
      }
    }

    // Source 2: competitor-buckets → buckets/competitors with name fields
    const buckets = context['competitor-buckets'] as
      | {
          direct?: Array<{ name?: string; domain?: string }>;
          indirect?: Array<{ name?: string; domain?: string }>;
          content?: Array<{ name?: string; domain?: string }>;
          aspirational?: Array<{ name?: string; domain?: string }>;
          competitors?: Array<{ name?: string; domain?: string; bucket?: string }>;
        }
      | undefined;
    if (buckets) {
      const allCompetitors = [
        ...(buckets.direct ?? []),
        ...(buckets.indirect ?? []),
        ...(buckets.content ?? []),
        ...(buckets.aspirational ?? []),
        ...(buckets.competitors ?? []),
      ];
      for (const c of allCompetitors) {
        if (c.domain) {
          const brand = c.domain.toLowerCase().replace(/\.[^.]+$/, '');
          if (brand.length >= MIN_BRAND_LENGTH) brands.add(brand);
        }
        if (c.name) {
          const name = c.name.toLowerCase().trim();
          if (name.length >= MIN_BRAND_LENGTH) brands.add(name);
        }
      }
    }

    return Array.from(brands);
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
      'content-images': 'content-images/content-images.prompt.md',
    };

    return stepPromptMap[stepKey] ?? `${stepKey}.prompt.md`;
  }

  /**
   * Strip base64 fields from content-images output before storing in workflow_context
   * or step_artifacts JSONB. The raw image bytes are persisted in the content_images
   * table by WorkflowMaterializerService; keeping them in JSONB bloats columns by 15–30 MB.
   */
  private stripImagesBase64(output: unknown): unknown {
    if (!output || typeof output !== 'object') return output;
    const data = output as Record<string, unknown>;
    if (!Array.isArray(data.images)) return output;
    return {
      ...data,
      images: (data.images as Array<Record<string, unknown>>).map((img) => ({
        ...img,
        base64: null,
      })),
    };
  }

  /**
   * Extract JSON from an LLM response that may contain markdown code blocks.
   */
  private extractJson(content: string): unknown {
    if (!content.trim()) return null;
    try {
      return JSON.parse(content);
    } catch {
      const jsonBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (jsonBlockMatch) {
        return JSON.parse(jsonBlockMatch[1]);
      }
      return content;
    }
  }
}
