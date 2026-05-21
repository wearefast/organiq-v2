import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { PromptService } from '../../shared/prompt/prompt.service';
import { ManagedAgentRuntime } from '../../agents/managed-agent.runtime';
import { AgentRegistry } from '../../agents/agent.registry';
import { OutputValidator } from '../../agents/output.validator';
import { VerificationService } from '../../shared/verification/verification.service';
import { AnthropicService } from '../integrations/anthropic/anthropic.service';
import { PipelineService } from './pipelines/pipeline.service';
import { SkillService } from '../../agents/skill.service';
import { CreditsService } from '../credits/credits.service';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowMaterializerService } from './workflow-materializer.service';
import { DlqService } from './dlq.service';
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
    private readonly managedAgentRuntime: ManagedAgentRuntime,
    private readonly agentRegistry: AgentRegistry,
    private readonly outputValidator: OutputValidator,
    private readonly verificationService: VerificationService,
    private readonly anthropicService: AnthropicService,
    private readonly pipelineService: PipelineService,
    private readonly creditsService: CreditsService,
    private readonly workflowService: WorkflowService,
    private readonly workflowGateway: WorkflowGateway,
    private readonly materializer: WorkflowMaterializerService,
    private readonly dlqService: DlqService,
    private readonly skillService: SkillService,
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

          await tx.update(workflowSteps).set({ status: 'completed', completedAt: new Date() }).where(eq(workflowSteps.id, step.id));

          // Debit credits inside transaction (atomic with artifact persistence)
          await this.creditsService.debit({
            organizationId,
            amount: agentDef.creditCost,
            description: `Pipeline: ${stepKey}`,
            workflowRunId,
            stepKey,
          });
        });

        this.workflowGateway.emitStepCompleted(workflowRunId, stepKey, 'completed');
        await this.materializer.materialize(workflowRunId, stepKey);
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

      if (executionType === 'pipeline-then-agent') {
        // Step 1: Run pipeline to fetch raw data
        const pipelineOutput = await this.pipelineService.execute(stepKey, transformedContext);

        // Step 2: Run managed agent to reason over pipeline data (no tools)
        const managedResult = await this.managedAgentRuntime.execute({
          managedAgentId: agentDef.managedAgentId ?? '',
          stepKey,
          runId: workflowRunId,
          context: transformedContext,
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
          allowedTools: [],
          skillContent,
          pipelineData: pipelineOutput,
        });

        if (managedResult.finishReason === 'error') {
          throw new Error(`Managed agent failed (pipeline-then-agent): ${managedResult.error}`);
        }

        result = {
          output: managedResult.output,
          reasoning: managedResult.reasoning,
          toolCalls: managedResult.toolCalls,
          totalTokens: managedResult.totalTokens,
          iterations: managedResult.toolCalls.length + 1,
          thinkingContent: null,
        };
      } else if (executionType === 'agent-only') {
        // Managed agent reasons over prior context only, no tools, no pipeline
        const managedResult = await this.managedAgentRuntime.execute({
          managedAgentId: agentDef.managedAgentId ?? '',
          stepKey,
          runId: workflowRunId,
          context: transformedContext,
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
          allowedTools: [],
          skillContent,
        });

        if (managedResult.finishReason === 'error') {
          throw new Error(`Managed agent failed (agent-only): ${managedResult.error}`);
        }

        result = {
          output: managedResult.output,
          reasoning: managedResult.reasoning,
          toolCalls: managedResult.toolCalls,
          totalTokens: managedResult.totalTokens,
          iterations: managedResult.toolCalls.length + 1,
          thinkingContent: null,
        };
      } else {
        // agent-with-tools: Managed Agents Sessions API with full tool loop
        const managedResult = await this.managedAgentRuntime.execute({
          managedAgentId: agentDef.managedAgentId ?? '',
          stepKey,
          runId: workflowRunId,
          context: transformedContext,
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
          allowedTools: agentDef.tools,
          skillContent,
        });

        if (managedResult.finishReason === 'error') {
          throw new Error(`Managed agent failed: ${managedResult.error}`);
        }

        result = {
          output: managedResult.output,
          reasoning: managedResult.reasoning,
          toolCalls: managedResult.toolCalls,
          totalTokens: managedResult.totalTokens,
          iterations: managedResult.toolCalls.length + 1,
          thinkingContent: null,
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

          // Retry uses same execution type, passing verification feedback
          const retryManaged = await this.managedAgentRuntime.execute({
            managedAgentId: agentDef.managedAgentId ?? '',
            stepKey,
            runId: workflowRunId,
            context: transformedContext,
            systemPrompt: prompt.system,
            userPrompt: prompt.user,
            allowedTools: executionType === 'agent-with-tools' ? agentDef.tools : [],
            skillContent,
            ...(executionType === 'pipeline-then-agent' ? { pipelineData: null } : {}),
            additionalInstructions: feedback,
          });
          if (retryManaged.finishReason === 'error') {
            throw new Error(`Managed agent retry failed: ${retryManaged.error}`);
          }
          result = {
            output: retryManaged.output,
            reasoning: retryManaged.reasoning,
            toolCalls: retryManaged.toolCalls,
            totalTokens: retryManaged.totalTokens,
            iterations: retryManaged.toolCalls.length + 1,
            thinkingContent: null,
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
          metadata: {
            thinkingTrace: result.thinkingContent ?? null,
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
        });

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
      if (result.output != null) {
        await this.workflowService.setContext(workflowRunId, stepKey, result.output);
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
      if (job.attemptsMade >= maxAttempts) {
        await this.dlqService.captureFailedJob({
          workflowStepId: undefined,
          workflowRunId,
          stepKey,
          error: message,
          attemptCount: job.attemptsMade,
          jobData: job.data as unknown as Record<string, unknown>,
        });
      }

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
    if (competitorBrands.length === 0) return context;

    const targetDomain = String(context['domain'] ?? '').toLowerCase();
    const targetBrand = targetDomain.replace(/\.[^.]+$/, '').toLowerCase();

    // Remove target brand from the filter list so own-brand keywords pass through
    const brandsToFilter = competitorBrands.filter(
      (b) => b !== targetBrand && !targetBrand.includes(b),
    );

    if (brandsToFilter.length === 0) return context;

    // Deep-clone consolidated keywords and filter out competitor-branded entries
    const consolidated = context['consolidated-keywords'] as
      | { keywords?: Array<{ keyword: string; [k: string]: unknown }> }
      | undefined;

    if (!consolidated?.keywords?.length) {
      return { ...context, 'competitor-brands': brandsToFilter };
    }

    const filteredKeywords = consolidated.keywords.filter((kw) => {
      const lower = kw.keyword.toLowerCase();
      return !brandsToFilter.some((brand) => lower.includes(brand));
    });

    const beforeCount = consolidated.keywords.length;
    const afterCount = filteredKeywords.length;
    if (beforeCount !== afterCount) {
      this.logger.log(
        `Topical-map brand filter: ${beforeCount} → ${afterCount} keywords (removed ${beforeCount - afterCount} competitor-branded)`,
      );
    }

    return {
      ...context,
      'consolidated-keywords': { ...consolidated, keywords: filteredKeywords },
      'competitor-brands': brandsToFilter,
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
