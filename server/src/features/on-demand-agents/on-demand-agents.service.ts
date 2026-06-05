import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { AgentRuntime } from '../../agents/agent.runtime';
import { CreditsService } from '../credits/credits.service';
import { ProjectIntelligenceService } from '../projects/project-intelligence.service';
import { AgentRouterService, AgentType, AGENT_CREDIT_COSTS, AGENT_TYPE_LABELS } from './agent-router.service';
import { ContextBuilderRegistry } from './context-builders/context-builder.registry';
import { agentRuns } from '../../db/schema';

export interface AgentRunRequest {
  projectId: string;
  organizationId: string;
  prompt: string;
  agentType?: string;
}

export interface AgentRunResponse {
  id: string;
  agentType: AgentType;
  agentLabel: string;
  response: string;
  recommendations: Array<{ title: string; rationale: string; action?: string }>;
  citedData: Array<{ metric: string; value: string; source: string }>;
  dataContextSummary: string;
  creditCost: number;
  durationMs: number;
}

@Injectable()
export class OnDemandAgentsService {
  private readonly logger = new Logger(OnDemandAgentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly agentRuntime: AgentRuntime,
    private readonly creditsService: CreditsService,
    private readonly intelligenceService: ProjectIntelligenceService,
    private readonly router: AgentRouterService,
    private readonly contextRegistry: ContextBuilderRegistry,
  ) {}

  async run(request: AgentRunRequest): Promise<AgentRunResponse> {
    const startTime = Date.now();
    const agentType = this.router.classify(request.prompt, request.agentType);
    const creditCost = AGENT_CREDIT_COSTS[agentType];

    // Pre-check credits
    const hasCredits = await this.creditsService.hasCredits(request.organizationId, creditCost);
    if (!hasCredits) {
      throw new ForbiddenException('Insufficient credits for this agent run');
    }

    // Create agent run record (status: running)
    const [runRecord] = await this.db.db
      .insert(agentRuns)
      .values({
        projectId: request.projectId,
        organizationId: request.organizationId,
        agentType,
        userPrompt: request.prompt,
        creditCost,
        status: 'running',
      })
      .returning();

    try {
      // Build context via type-specific builder
      const builder = this.contextRegistry.get(agentType);
      const context = await builder.build(request.projectId, request.prompt);

      // Assemble project intelligence context
      const pisContext = await this.intelligenceService.assembleContext({
        projectId: request.projectId,
        organizationId: request.organizationId,
      });
      const intelligenceXml = this.intelligenceService.renderContextXml(pisContext);

      // Execute via AgentRuntime (structured output via return_output tool)
      // 5-minute wall-clock timeout — prevents indefinite hangs on Anthropic API delays.
      const abortController = new AbortController();
      const abortTimer = setTimeout(() => {
        this.logger.error(`On-demand agent [${agentType}] exceeded 5-minute timeout — aborting`);
        abortController.abort(new Error(`On-demand agent timed out after 5 minutes`));
      }, 5 * 60 * 1000);

      let result;
      try {
        result = await this.agentRuntime.execute({
          stepKey: `on-demand:${agentType}`,
          projectId: request.projectId,
          organizationId: request.organizationId,
          systemPrompt: context.systemPrompt,
          userPrompt: request.prompt,
          allowedTools: [],
          pipelineData: context.dataContext,
          intelligenceContext: intelligenceXml || undefined,
          maxIterations: 2,
          signal: abortController.signal,
        });
      } finally {
        clearTimeout(abortTimer);
      }

      if (result.finishReason === 'error') {
        throw new Error(`Agent runtime failed: ${result.error}`);
      }

      // Extract structured output (AgentRuntime guarantees JSON via return_output)
      const parsed = this.extractStructuredOutput(result.output);
      const durationMs = Date.now() - startTime;

      // Update record with success
      await this.db.db
        .update(agentRuns)
        .set({
          status: 'completed',
          response: parsed.response,
          recommendations: parsed.recommendations,
          citedData: parsed.citedData,
          durationMs,
        })
        .where(eq(agentRuns.id, runRecord.id));

      // Debit credits on success (AD-8) — must charge even if PIS write fails
      await this.creditsService.debit({
        organizationId: request.organizationId,
        amount: creditCost,
        description: `Agent run: ${AGENT_TYPE_LABELS[agentType]}`,
      });

      // Write result to PIS (best-effort — failure must not revert the run)
      try {
        await this.intelligenceService.upsert({
          projectId: request.projectId,
          organizationId: request.organizationId,
          dataType: `on-demand:${agentType}`,
          targetKey: `latest`,
          data: { response: parsed.response, recommendations: parsed.recommendations, citedData: parsed.citedData },
          producedBy: `on-demand:${agentType}`,
        });
      } catch (pisError) {
        this.logger.warn(
          `PIS write failed for run ${runRecord.id}: ${pisError instanceof Error ? pisError.message : 'Unknown'}`,
        );
      }

      return {
        id: runRecord.id,
        agentType,
        agentLabel: AGENT_TYPE_LABELS[agentType],
        response: parsed.response,
        recommendations: parsed.recommendations,
        citedData: parsed.citedData,
        dataContextSummary: context.summary,
        creditCost,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update record with failure (no credit charge per AD-8)
      await this.db.db
        .update(agentRuns)
        .set({
          status: 'failed',
          error: errMessage,
          durationMs,
        })
        .where(eq(agentRuns.id, runRecord.id));

      this.logger.error(`Agent run failed: ${errMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async getHistory(projectId: string, limit = 20) {
    return this.db.db.query.agentRuns.findMany({
      where: eq(agentRuns.projectId, projectId),
      orderBy: [desc(agentRuns.createdAt)],
      limit,
    });
  }

  /**
   * Extract structured output from AgentRuntime result.
   * The runtime uses return_output tool, so output is typically already structured JSON.
   * Falls back gracefully if the agent returned raw text.
   */
  private extractStructuredOutput(output: unknown): {
    response: string;
    recommendations: Array<{ title: string; rationale: string; action?: string }>;
    citedData: Array<{ metric: string; value: string; source: string }>;
  } {
    if (output && typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      return {
        response: typeof obj.response === 'string' ? obj.response : (typeof obj.summary === 'string' ? obj.summary : JSON.stringify(output)),
        recommendations: Array.isArray(obj.recommendations) ? obj.recommendations : [],
        citedData: Array.isArray(obj.citedData) ? obj.citedData : [],
      };
    }

    // Fallback: raw string output
    return {
      response: typeof output === 'string' ? output : JSON.stringify(output),
      recommendations: [],
      citedData: [],
    };
  }
}
