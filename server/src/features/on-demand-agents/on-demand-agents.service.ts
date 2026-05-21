import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { AnthropicService } from '../integrations/anthropic/anthropic.service';
import { CreditsService } from '../credits/credits.service';
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
    private readonly anthropicService: AnthropicService,
    private readonly creditsService: CreditsService,
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
      // Build context
      const builder = this.contextRegistry.get(agentType);
      const context = await builder.build(request.projectId, request.prompt);

      // Execute LLM call via AnthropicService (single-shot, no tools)
      const chatResult = await this.anthropicService.chat({
        system: context.systemPrompt,
        messages: [{ role: 'user', content: context.dataContext }],
        model: 'claude-sonnet-4-20250514',
        temperature: 0.3,
        maxTokens: 8192,
      });

      if (!chatResult.content) {
        throw new Error('Agent returned empty response');
      }

      // Parse the response into structured output
      const parsed = this.parseResponse(chatResult.content);
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

      // Debit credits only on success (AD-8)
      await this.creditsService.debit({
        organizationId: request.organizationId,
        amount: creditCost,
        description: `Agent run: ${AGENT_TYPE_LABELS[agentType]}`,
      });

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

  private parseResponse(rawOutput: string): {
    response: string;
    recommendations: Array<{ title: string; rationale: string; action?: string }>;
    citedData: Array<{ metric: string; value: string; source: string }>;
  } {
    // Try to extract structured JSON from the response
    const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          response: parsed.response ?? parsed.summary ?? rawOutput,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          citedData: Array.isArray(parsed.citedData) ? parsed.citedData : [],
        };
      } catch {
        // Fall through to plain text parsing
      }
    }

    // Plain text response — extract recommendations from numbered lists
    const recommendations: Array<{ title: string; rationale: string; action?: string }> = [];
    const lines = rawOutput.split('\n');
    let currentRec: { title: string; rationale: string } | null = null;

    for (const line of lines) {
      const numbered = line.match(/^\d+\.\s+\*\*(.+?)\*\*[:\s-]*(.*)/);
      if (numbered) {
        if (currentRec) recommendations.push(currentRec);
        currentRec = { title: numbered[1], rationale: numbered[2] || '' };
      } else if (currentRec && line.trim().startsWith('-')) {
        currentRec.rationale += ' ' + line.trim().slice(1).trim();
      }
    }
    if (currentRec) recommendations.push(currentRec);

    return {
      response: rawOutput,
      recommendations: recommendations.slice(0, 10),
      citedData: [],
    };
  }
}
