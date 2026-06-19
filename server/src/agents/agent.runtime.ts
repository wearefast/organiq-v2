import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService, AnthropicToolDef } from '../features/integrations/anthropic/anthropic.service';
import { ToolSandbox } from './tool.sandbox';
import { ToolRegistry } from './tool.registry';
import { ProjectIntelligenceService } from '../features/projects/project-intelligence.service';
import { WorkflowLogger, summarizeToolInput } from '../shared/utils/workflow-logger';

// ─── Public Interfaces ───────────────────────────────────────

export interface AgentRuntimeConfig {
  /** Step key or agent type identifier */
  stepKey: string;
  /** Project and org context for PIS writes */
  projectId: string;
  organizationId: string;
  /** Optional target key for multi-target context */
  targetKey?: string | null;
  /** Workflow run ID (if running within a workflow) */
  workflowRunId?: string | null;
  /** Model override (defaults to claude-sonnet-4) */
  model?: string;
  /** System prompt (already rendered with project data) */
  systemPrompt: string;
  /** User message (task + pipeline data) */
  userPrompt: string;
  /** Tools this agent is allowed to call */
  allowedTools: string[];
  /** Optional thinking budget for extended thinking */
  thinkingBudget?: number;
  /** Max agentic loop iterations (safety: prevents infinite loops) */
  maxIterations?: number;
  /** Project intelligence XML context (pre-rendered) */
  intelligenceContext?: string;
  /** Skill content to prepend */
  skillContent?: string | null;
  /** Pipeline data for context */
  pipelineData?: unknown;
  /** Workflow context from upstream steps */
  workflowContext?: Record<string, unknown>;
  /**
   * If set, only these keys from workflowContext are included in the <workflow_context> block.
   * Reduces input token count at late-stage steps that only need a few upstream outputs.
   * When absent, the full workflowContext is passed (backwards-compatible).
   */
  contextKeys?: string[];
  /** AbortSignal forwarded to Anthropic SDK — fires when the step wall-clock timeout expires. */
  signal?: AbortSignal;
}

export interface AgentRuntimeResult {
  output: unknown;
  reasoning: string | null;
  thinkingContent: string | null;
  toolCalls: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    durationMs: number;
    success: boolean;
  }>;
  totalTokens: { input: number; output: number };
  iterations: number;
  finishReason: 'completed' | 'max_iterations' | 'error';
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 25;
const DEFAULT_MODEL = 'claude-sonnet-4';

// ─── Universal Tools ─────────────────────────────────────────

const RETURN_OUTPUT_TOOL: AnthropicToolDef = {
  name: 'return_output',
  description: 'Return the final structured JSON output for this step. Call this when you have completed your analysis and are ready to return results. The data field must contain your complete structured output.',
  input_schema: {
    type: 'object',
    properties: {
      data: { description: 'The structured JSON output for this step' },
    },
    required: ['data'],
  },
};

const FLAG_STALE_DATA_TOOL: AnthropicToolDef = {
  name: 'flag_stale_data',
  description: 'Flag a piece of project intelligence data as potentially stale and suggest the user refresh it. Use this when you notice data that may be outdated based on timestamps, inconsistencies, or known refresh intervals.',
  input_schema: {
    type: 'object',
    properties: {
      data_type: { type: 'string', description: 'The intelligence data_type that is stale (e.g. "site-audit", "competitor-metrics")' },
      reason: { type: 'string', description: 'Why this data appears stale' },
      last_updated: { type: 'string', description: 'ISO timestamp of when the data was last updated' },
    },
    required: ['data_type', 'reason'],
  },
};

@Injectable()
export class AgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);

  // Steps that generate large outputs get a higher output token budget so
  // they can write planning prose before the return_output tool call without
  // exhausting the standard 16 384-token limit.
  private static readonly STEP_MAX_OUTPUT_TOKENS: Record<string, number> = {
    'method01-competitor-pages': 32000,
    'method02-seed-expansion': 32000,
    'method03-content-gap-import': 32000,
    'consolidated-keywords': 32000,
    'topical-map': 64000,
    'verdict-strategy': 32000,
  };

  constructor(
    private readonly anthropic: AnthropicService,
    private readonly toolSandbox: ToolSandbox,
    private readonly toolRegistry: ToolRegistry,
    private readonly intelligenceService: ProjectIntelligenceService,
  ) {}

  /**
   * Execute an agent via Claude Messages API with a local agentic tool loop.
   * Continues calling Claude until the model stops requesting tools or max iterations hit.
   */
  async execute(config: AgentRuntimeConfig): Promise<AgentRuntimeResult> {
    const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const model = config.model ?? DEFAULT_MODEL;
    const toolCalls: AgentRuntimeResult['toolCalls'] = [];
    let totalInput = 0;
    let totalOutput = 0;
    let iterations = 0;
    let thinkingContent: string | null = null;
    let capturedOutput: unknown = undefined;

    // Build system prompt blocks with cache control for cost reduction
    const system = this.buildSystemBlocks(config);

    // Build tool definitions for Claude
    const tools = this.buildToolDefs(config.allowedTools);

    // Initialize messages with user prompt
    const messages: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }> = [
      { role: 'user', content: this.buildUserMessage(config) },
    ];

    // Estimate context size in tokens (~4 chars/token) for observability
    const ctxTokenEst = Math.round(this.buildUserMessage(config).length / 4);

    // Use WorkflowLogger if we have a run context; fall back to plain logger otherwise
    const wl = config.workflowRunId
      ? new WorkflowLogger(this.logger, config.workflowRunId, config.stepKey)
      : null;

    wl?.agentStart(model, tools.length, maxIterations, ctxTokenEst);
    if (!wl) this.logger.log(`AgentRuntime: starting ${config.stepKey} (model=${model}, tools=${tools.length}, maxIter=${maxIterations})`);

    const agentStartMs = Date.now();

    // ─── Agentic Loop ──────────────────────────────────────────

    try {
      while (iterations < maxIterations) {
        iterations++;
        const iterStartMs = Date.now();

        const response = await this.anthropic.chat({
          model,
          system,
          messages,
          tools,
          maxTokens: config.thinkingBudget
            ? config.thinkingBudget + 16384
            : (AgentRuntime.STEP_MAX_OUTPUT_TOKENS[config.stepKey] ?? 16384),
          thinkingBudget: config.thinkingBudget,
          signal: config.signal,
        });

        const iterDurationMs = Date.now() - iterStartMs;
        totalInput += response.usage.inputTokens;
        totalOutput += response.usage.outputTokens;

        // Per-iteration log with full token breakdown and timing
        wl?.agentIteration(
          iterations,
          maxIterations,
          response.stopReason,
          response.usage.inputTokens,
          response.usage.outputTokens,
          response.usage.cacheReadTokens ?? 0,
          response.usage.cacheCreationTokens ?? 0,
          iterDurationMs,
        );
        if (!wl) {
          // Log cache utilization on first iteration for cost visibility
          if (iterations === 1 && (response.usage.cacheReadTokens || response.usage.cacheCreationTokens)) {
            this.logger.log(
              `AgentRuntime: [${config.stepKey}] cache: ${response.usage.cacheReadTokens ?? 0} read, ${response.usage.cacheCreationTokens ?? 0} created`,
            );
          }
        }

        // Capture thinking content from first iteration (most relevant)
        if (response.thinkingContent && !thinkingContent) {
          thinkingContent = response.thinkingContent;
        }

        // If no tool use, the agent is done
        if (response.stopReason !== 'tool_use' || response.toolUse.length === 0) {
          // Try to extract output from final text if not already captured
          if (capturedOutput === undefined && response.content) {
            capturedOutput = this.extractJson(response.content);
          }
          break;
        }

        // Build assistant message with tool_use blocks for conversation history
        const assistantContent: Array<Record<string, unknown>> = [];
        if (response.content) {
          assistantContent.push({ type: 'text', text: response.content });
        }
        for (const tu of response.toolUse) {
          assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
        }
        messages.push({ role: 'assistant', content: assistantContent });

        // Execute each tool call and build tool_result messages
        const toolResults: Array<Record<string, unknown>> = [];

        for (const toolUse of response.toolUse) {
          const start = Date.now();
          let toolResult: { success: boolean; result?: unknown; error?: string };

          // Handle universal tools locally
          if (toolUse.name === 'return_output') {
            capturedOutput = (toolUse.input as any)?.data;
            toolResult = { success: true, result: { acknowledged: true } };
            wl?.log(`RETURN_OUTPUT captured`);
            if (!wl) this.logger.debug(`AgentRuntime: captured return_output for ${config.stepKey}`);
          } else if (toolUse.name === 'flag_stale_data') {
            toolResult = await this.handleFlagStaleData(config, toolUse.input);
          } else {
            const toolCallStartMs = Date.now();
            if (!wl) this.logger.log(`AgentRuntime: [${config.stepKey}] iter=${iterations} calling tool=${toolUse.name}`);
            // Execute via sandbox (validates allowed tools)
            toolResult = await this.toolSandbox.execute(
              config.allowedTools,
              toolUse.name,
              toolUse.input,
            );
            const toolDurationMs = Date.now() - toolCallStartMs;
            wl?.toolCall(
              toolUse.name,
              summarizeToolInput(toolUse.input),
              toolResult.success,
              toolDurationMs,
              toolResult.success ? undefined : String(toolResult.error),
            );
          }

          const durationMs = Date.now() - start;
          toolCalls.push({
            toolName: toolUse.name,
            input: toolUse.input,
            output: toolResult.success ? toolResult.result : toolResult.error,
            durationMs,
            success: toolResult.success,
          });

          // Strip large binary payloads from the conversation history.
          // generate_image returns a 1–2 MB base64 string per image; if left in the
          // messages array it accumulates across iterations and sends 3M+ tokens to
          // the API by the time the 5th image is generated.  The full result is already
          // captured in toolCalls above for artifact storage — only the conversation
          // history copy needs to be lightweight.
          let historyContent: unknown;
          if (toolUse.name === 'generate_image' && toolResult.success && toolResult.result) {
            const r = toolResult.result as Record<string, unknown>;
            historyContent = {
              success: true,
              revisedPrompt: r.revisedPrompt ?? '',
              note: 'Image generated successfully (base64 omitted from conversation history)',
            };
          } else {
            historyContent = toolResult.success ? toolResult.result : { error: toolResult.error };
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(historyContent),
            is_error: !toolResult.success,
          });
        }

        messages.push({ role: 'user', content: toolResults });

        // If return_output was called, stop looping (agent is done)
        if (capturedOutput !== undefined) {
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const agentDurationMs = Date.now() - agentStartMs;
      wl?.error(`AGENT_ERROR after ${iterations} iterations, ${agentDurationMs}ms — ${message}`);
      if (!wl) this.logger.error(`AgentRuntime: ${config.stepKey} failed — ${message}`);

      return {
        output: capturedOutput ?? null,
        reasoning: null,
        thinkingContent,
        toolCalls,
        totalTokens: { input: totalInput, output: totalOutput },
        iterations,
        finishReason: 'error',
        error: message,
      };
    }

    // ─── Result ────────────────────────────────────────────────

    const finishReason = iterations >= maxIterations && capturedOutput === undefined
      ? 'max_iterations'
      : 'completed';

    if (finishReason === 'max_iterations') {
      wl?.warn(`MAX_ITERATIONS hit (${maxIterations}) — output may be incomplete`);
      if (!wl) this.logger.warn(`AgentRuntime: ${config.stepKey} hit max iterations (${maxIterations})`);
    }

    const agentTotalMs = Date.now() - agentStartMs;
    wl?.agentCompleted(finishReason, iterations, totalInput, totalOutput, toolCalls.length, agentTotalMs);
    if (!wl) {
      this.logger.log(
        `AgentRuntime: completed ${config.stepKey} (${iterations} iterations, ${toolCalls.length} tool calls, ${totalInput + totalOutput} tokens)`,
      );
    }

    return {
      output: capturedOutput ?? null,
      reasoning: thinkingContent ? null : this.buildReasoningSummary(config, toolCalls),
      thinkingContent,
      toolCalls,
      totalTokens: { input: totalInput, output: totalOutput },
      iterations,
      finishReason,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private buildSystemBlocks(config: AgentRuntimeConfig): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } | null }> {
    const blocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } | null }> = [];

    // Main system prompt — cacheable (same prompt reused across agentic loop iterations,
    // and Anthropic's 5-min cache means sequential steps in a workflow run share the cache).
    // Guard: Anthropic rejects cache_control on empty text blocks, so skip if no system prompt.
    if (config.systemPrompt) {
      blocks.push({
        type: 'text',
        text: config.systemPrompt,
        cache_control: { type: 'ephemeral' },
      });
    } else {
      this.logger.warn(`[run:${config.workflowRunId} step:${config.stepKey}] systemPrompt is empty — skipping cacheable system block`);
    }

    // Project intelligence context — cacheable (identical across all steps in a run;
    // changes only when a new step writes to PIS, which is rare mid-run).
    if (config.intelligenceContext) {
      blocks.push({
        type: 'text',
        text: config.intelligenceContext,
        cache_control: { type: 'ephemeral' },
      });
    }

    // Instruction block — not cached (small, and always the same static text)
    blocks.push({
      type: 'text',
      text: '\n\nIMPORTANT: When you have completed your analysis, you MUST call the `return_output` tool with your structured JSON result. Do not output raw JSON text — use the tool.',
    });

    return blocks;
  }

  private buildUserMessage(config: AgentRuntimeConfig): string {
    const parts: string[] = [];

    if (config.skillContent) {
      parts.push(`<skill_context>\n${config.skillContent}\n</skill_context>`);
    }

    if (config.pipelineData !== undefined) {
      // Truncate long string values in pipelineData to avoid sending entire scraped
      // pages (~100K+ chars each) verbatim to the LLM.  The content-brief pipeline
      // fetches up to 3 Firecrawl pages; without this cap each run costs ~150K
      // extra input tokens.  20 000 chars keeps meaningful content while capping
      // spend.  Non-string values (objects, arrays, numbers) are left intact.
      const MAX_STRING_CHARS = 20_000;
      const capped = JSON.parse(
        JSON.stringify(config.pipelineData, (_key, val) =>
          typeof val === 'string' && val.length > MAX_STRING_CHARS
            ? val.slice(0, MAX_STRING_CHARS) + '…[truncated]'
            : val,
        ),
      ) as unknown;
      parts.push(`<pipeline_data>\n${JSON.stringify(capped, null, 2)}\n</pipeline_data>`);
    }

    if (config.workflowContext && Object.keys(config.workflowContext).length > 0) {
      const ctx =
        config.contextKeys !== undefined
          ? Object.fromEntries(
              config.contextKeys
                .filter((k) => k in config.workflowContext!)
                .map((k) => [k, config.workflowContext![k]]),
            )
          : config.workflowContext;
      if (Object.keys(ctx).length > 0) {
        parts.push(`<workflow_context>\n${JSON.stringify(ctx, null, 2)}\n</workflow_context>`);
      }
    }

    parts.push(config.userPrompt);

    return parts.join('\n\n');
  }

  private buildToolDefs(allowedTools: string[]): AnthropicToolDef[] {
    const defs: AnthropicToolDef[] = [RETURN_OUTPUT_TOOL, FLAG_STALE_DATA_TOOL];

    for (const toolName of allowedTools) {
      const tool = this.toolRegistry.getTool(toolName);
      if (tool) {
        defs.push({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        });
      } else {
        this.logger.warn(`AgentRuntime: tool "${toolName}" not found in registry, skipping`);
      }
    }

    return defs;
  }

  private async handleFlagStaleData(
    config: AgentRuntimeConfig,
    input: Record<string, unknown>,
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
      const suggestion = await this.intelligenceService.createRefreshSuggestion({
        projectId: config.projectId,
        organizationId: config.organizationId,
        targetKey: config.targetKey ?? null,
        dataType: input.data_type as string,
        lastUpdated: input.last_updated ? new Date(input.last_updated as string) : new Date(),
        reason: input.reason as string,
        suggestedBy: config.stepKey,
      });
      return { success: true, result: { id: suggestion.id, acknowledged: true } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`flag_stale_data failed: ${message}`);
      return { success: false, error: message };
    }
  }

  private buildReasoningSummary(
    config: AgentRuntimeConfig,
    toolCalls: AgentRuntimeResult['toolCalls'],
  ): string {
    const lines = [
      `Agent: ${config.stepKey}`,
      `Tools called: ${toolCalls.length}`,
    ];
    if (toolCalls.length > 0) {
      lines.push(`Tool sequence: ${toolCalls.map((tc) => tc.toolName).join(' → ')}`);
    }
    return lines.join('\n');
  }

  private extractJson(text: string): unknown {
    // Try to parse the entire text as JSON
    try {
      return JSON.parse(text);
    } catch {
      // Try to find JSON in code blocks
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1]);
        } catch {
          // fall through
        }
      }

      // Try to find an outermost balanced JSON object or array
      const startIdx = text.search(/[\[{]/);
      if (startIdx !== -1) {
        const startChar = text[startIdx];
        const endChar = startChar === '{' ? '}' : ']';
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = startIdx; i < text.length; i++) {
          const ch = text[i];
          if (escaped) { escaped = false; continue; }
          if (ch === '\\' && inString) { escaped = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === startChar) depth++;
          else if (ch === endChar) { depth--; if (depth === 0) { try { return JSON.parse(text.slice(startIdx, i + 1)); } catch { break; } } }
        }
      }
    }
    // No valid JSON found — return null so the caller knows extraction failed.
    // Previously returned raw text which corrupted downstream workflow context.
    return null;
  }
}
