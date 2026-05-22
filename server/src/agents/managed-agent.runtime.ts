import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ToolSandbox } from './tool.sandbox';

export interface ManagedAgentConfig {
  /** The Anthropic managed agent ID (from platform) */
  managedAgentId: string;
  /** Step key for logging */
  stepKey: string;
  /** Workflow run ID for session title */
  runId: string;
  /** Full workflow context (upstream step outputs, project data) */
  context: Record<string, unknown>;
  /** Rendered system prompt (with project-specific data interpolated) */
  systemPrompt: string;
  /** Rendered user prompt (task instructions with data) */
  userPrompt: string;
  /** Allowed tool names for this agent (empty array = no tools) */
  allowedTools: string[];
  /** Optional user instructions to append (e.g., verification feedback) */
  additionalInstructions?: string;
  /** Skill content (domain expertise) to inject into user message */
  skillContent?: string | null;
  /** Pre-fetched pipeline data to inject for pipeline-then-agent steps */
  pipelineData?: unknown;
}

export interface ManagedAgentResult {
  output: unknown;
  reasoning: string;
  toolCalls: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    durationMs: number;
    success: boolean;
  }>;
  totalTokens: number;
  finishReason: 'completed' | 'error';
  error?: string;
  sessionId: string;
}

@Injectable()
export class ManagedAgentRuntime {
  private readonly logger = new Logger(ManagedAgentRuntime.name);
  private readonly client: Anthropic;
  private readonly environmentId: string;
  private static readonly SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly toolSandbox: ToolSandbox,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');
    this.client = new Anthropic({ apiKey });
    this.environmentId = this.configService.get<string>('MANAGED_AGENT_ENVIRONMENT_ID', '');
  }

  /**
   * Execute a Tier 3 agent via Claude Managed Agents Sessions API.
   * Creates a session, sends the full workflow context, handles custom tool events,
   * and returns the final structured output.
   */
  async execute(config: ManagedAgentConfig): Promise<ManagedAgentResult> {
    if (!this.environmentId) {
      throw new Error('MANAGED_AGENT_ENVIRONMENT_ID not configured');
    }

    const toolCalls: ManagedAgentResult['toolCalls'] = [];
    let outputText = '';
    let totalTokens = 0;
    let thinkingEvents = 0;
    let capturedOutput: unknown = undefined; // set when agent calls return_output

    if (config.pipelineData !== undefined) {
      toolCalls.push({
        toolName: `pipeline.${config.stepKey}`,
        input: this.summarizeExecutionInputs(config),
        output: this.summarizePipelineData(config.pipelineData),
        durationMs: 0,
        success: true,
      });
    }

    this.logger.log(
      `Starting managed session: ${config.stepKey} (agent: ${config.managedAgentId}, run: ${config.runId})`,
    );

    // 1. Create session
    const session = await (this.client.beta as any).sessions.create({
      agent: config.managedAgentId,
      environment_id: this.environmentId,
      title: `${config.stepKey} — run ${config.runId}`,
    });

    const sessionId = session.id;
    this.logger.debug(`Session created: ${sessionId}`);

    try {
      // 2. Build the user message with full context (no truncation)
      const userContent = this.buildUserMessage(config);

      // 3. Open event stream and send user message
      const stream = await (this.client.beta as any).sessions.events.stream(sessionId);

      await (this.client.beta as any).sessions.events.send(sessionId, {
        events: [
          {
            type: 'user.message',
            content: [{ type: 'text', text: userContent }],
          },
        ],
      });

      // 4. Process events with timeout
      const timeoutAt = Date.now() + ManagedAgentRuntime.SESSION_TIMEOUT_MS;

      for await (const event of stream) {
        if (Date.now() > timeoutAt) {
          this.logger.error(`Session ${sessionId} timed out for step ${config.stepKey}`);
          throw new Error(`Managed agent session timed out after ${ManagedAgentRuntime.SESSION_TIMEOUT_MS / 1000}s`);
        }

        switch (event.type) {
          case 'agent.custom_tool_use': {
            // Claude wants to call one of our custom tools (registered in Claude Console)
            const toolName = event.name as string;
            const toolInput = event.input as unknown;
            const toolUseId = event.id as string;
            const sessionThreadId = (event as any).session_thread_id as string | null | undefined;

            this.logger.debug(`Tool call: ${toolName} (session: ${sessionId})`);
            const start = Date.now();

            // Capture structured output when the agent calls return_output
            if (toolName === 'return_output') {
              const data = (toolInput as any)?.data;
              if (data !== undefined) {
                capturedOutput = data;
                this.logger.debug(`Captured structured output via return_output for ${config.stepKey}`);
              }
            }

            // Execute via our existing ToolSandbox (validates allowed tools + executes)
            const toolResult = await this.toolSandbox.execute(
              config.allowedTools,
              toolName,
              toolInput,
            );

            const durationMs = Date.now() - start;

            toolCalls.push({
              toolName,
              input: toolInput,
              output: toolResult.success ? toolResult.result : toolResult.error,
              durationMs,
              success: toolResult.success,
            });

            // Send FULL result back using the correct custom tool result event schema
            const resultContent = JSON.stringify(
              toolResult.success ? toolResult.result : { error: toolResult.error },
            );

            const toolResultEvent: Record<string, unknown> = {
              type: 'user.custom_tool_result',
              custom_tool_use_id: toolUseId,
              content: [{ type: 'text', text: resultContent }],
              is_error: !toolResult.success,
            };
            if (sessionThreadId) {
              toolResultEvent.session_thread_id = sessionThreadId;
            }

            await (this.client.beta as any).sessions.events.send(sessionId, {
              events: [toolResultEvent],
            });

            break;
          }

          case 'agent.message': {
            // Collect agent text output
            if (event.content) {
              for (const block of event.content as Array<{ type: string; text?: string }>) {
                if (block.type === 'text' && block.text) {
                  outputText += block.text;
                }
              }
            }
            break;
          }

          case 'agent.thinking': {
            thinkingEvents += 1;
            break;
          }

          case 'session.status_idle': {
            // Only log here; break logic is handled after the switch
            const stopReason = (event as any).stop_reason as { type: string } | undefined;
            this.logger.debug(`Session idle (stop_reason: ${stopReason?.type ?? 'unknown'}): ${sessionId}`);
            break;
          }

          case 'span.model_request_end': {
            // Track token usage from the correct event type
            const usage = (event as any).model_usage as { input_tokens?: number; output_tokens?: number } | undefined;
            if (usage) {
              totalTokens += (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
            }
            break;
          }
        }

        // Only break when the agent has truly finished (end_turn or retries_exhausted).
        // On requires_action the session is waiting for custom tool results we've already sent — keep listening.
        if (event.type === 'session.status_idle') {
          const stopReason = (event as any).stop_reason as { type: string } | undefined;
          if (stopReason?.type !== 'requires_action') break;
        }
      }

      // 5. Parse the output — prefer captured return_output over text parsing
      const output = capturedOutput !== undefined
        ? capturedOutput
        : this.extractJson(outputText);

      this.logger.log(
        `Session completed: ${config.stepKey} (${toolCalls.length} tool calls, session: ${sessionId})`,
      );

      return {
        output,
        reasoning: this.buildReasoningTrace(config, output, thinkingEvents),
        toolCalls,
        totalTokens,
        finishReason: 'completed',
        sessionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Managed agent session failed: ${config.stepKey} — ${message}`);

      return {
        output: null,
        reasoning: message,
        toolCalls,
        totalTokens,
        finishReason: 'error',
        error: message,
        sessionId,
      };
    }
  }

  private buildUserMessage(config: ManagedAgentConfig): string {
    const parts: string[] = [];

    // Skill content (domain expertise) — injected first so agent has context before task
    if (config.skillContent) {
      parts.push(`<skill_context>\n${config.skillContent}\n</skill_context>`);
    }

    // System-level instructions (rendered with project data)
    if (config.systemPrompt) {
      parts.push(`<system_instructions>\n${config.systemPrompt}\n</system_instructions>`);
    }

    // Task-specific user prompt
    if (config.userPrompt) {
      parts.push(`<task>\n${config.userPrompt}\n</task>`);
    }

    // Pre-fetched pipeline data (freshly collected for this step)
    if (config.pipelineData !== undefined) {
      parts.push(`<pipeline_data>\n${JSON.stringify(config.pipelineData, null, 2)}\n</pipeline_data>`);
    }

    // Full workflow context from upstream steps
    if (config.context && Object.keys(config.context).length > 0) {
      parts.push(`<workflow_context>\n${JSON.stringify(config.context, null, 2)}\n</workflow_context>`);
    }

    if (config.additionalInstructions) {
      parts.push(`<additional_instructions>\n${config.additionalInstructions}\n</additional_instructions>`);
    }

    parts.push('Analyze all provided context and produce your structured JSON output.');

    return parts.join('\n\n');
  }

  private buildReasoningTrace(
    config: ManagedAgentConfig,
    output: unknown,
    thinkingEvents: number,
  ): string {
    const sections = [
      'Execution trace',
      [
        `Managed agent: ${config.managedAgentId}`,
        `Allowed tools: ${config.allowedTools.length > 0 ? config.allowedTools.join(', ') : 'none'}`,
        `Skill context supplied: ${config.skillContent ? 'yes' : 'no'}`,
        `System instructions supplied: ${config.systemPrompt ? 'yes' : 'no'}`,
        `Task instructions supplied: ${config.userPrompt ? 'yes' : 'no'}`,
        `Workflow context keys: ${Object.keys(config.context ?? {}).length > 0 ? Object.keys(config.context).join(', ') : 'none'}`,
        `Managed-agent thinking progress events observed: ${thinkingEvents}`,
      ].join('\n- '),
      this.renderSection('Inputs sent to the agent', this.summarizeExecutionInputs(config)),
      this.renderSection('Pipeline evidence available to the agent', this.summarizePipelineData(config.pipelineData)),
      this.renderSection('Explicit rationale returned by the agent', this.extractExplicitRationale(output)),
      [
        'Sessions API note',
        'Anthropic Managed Agents exposes tool-use and progress events, but it does not expose private chain-of-thought text.',
        'This panel therefore shows the exact input package sent to the agent and the rationale it returned explicitly in structured fields.',
      ].join('\n'),
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  private renderSection(title: string, value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';
      return `${title}\n${trimmed}`;
    }

    return `${title}\n${JSON.stringify(value, null, 2)}`;
  }

  private summarizeExecutionInputs(config: ManagedAgentConfig): Record<string, unknown> {
    return {
      stepKey: config.stepKey,
      managedAgentId: config.managedAgentId,
      allowedTools: config.allowedTools,
      hasSkillContext: Boolean(config.skillContent),
      hasSystemPrompt: Boolean(config.systemPrompt),
      hasUserPrompt: Boolean(config.userPrompt),
      workflowContextKeys: Object.keys(config.context ?? {}),
    };
  }

  private summarizePipelineData(pipelineData: unknown): unknown {
    if (!pipelineData || typeof pipelineData !== 'object') {
      return pipelineData ?? null;
    }

    const pipelineRecord = pipelineData as Record<string, unknown>;
    const summary: Record<string, unknown> = {};

    if (pipelineRecord.metadata && typeof pipelineRecord.metadata === 'object') {
      summary.metadata = pipelineRecord.metadata;
    }

    if (pipelineRecord.rawData && typeof pipelineRecord.rawData === 'object') {
      const rawData = pipelineRecord.rawData as Record<string, unknown>;
      const rawSummary: Record<string, unknown> = {};

      if (rawData.domain) {
        rawSummary.domain = rawData.domain;
      }

      if (Array.isArray(rawData.scrapedPages)) {
        rawSummary.scrapedPages = rawData.scrapedPages.map((page) => {
          if (!page || typeof page !== 'object') {
            return { url: null, hasData: false };
          }

          const pageRecord = page as Record<string, unknown>;
          return {
            url: pageRecord.url ?? null,
            hasData: pageRecord.data != null,
          };
        });
      }

      if (Array.isArray(rawData.items)) {
        rawSummary.itemCount = rawData.items.length;
      }

      if (Object.keys(rawSummary).length > 0) {
        summary.rawData = rawSummary;
      }
    }

    return Object.keys(summary).length > 0 ? summary : pipelineData;
  }

  private extractExplicitRationale(output: unknown): Record<string, string> | null {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return null;
    }

    const rationaleKeys = [
      'reason',
      'reasoning',
      'rationale',
      'explanation',
      'summary',
      'analysis',
      'notes',
      'findings',
      'insights',
      'analyst_notes',
      'positioning',
      'brand_voice',
    ];

    const extracted: Record<string, string> = {};
    const visit = (value: unknown, path: string[]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return;
      }

      for (const [key, child] of Object.entries(value)) {
        const nextPath = [...path, key];
        const normalizedKey = key.toLowerCase();

        if (typeof child === 'string' && rationaleKeys.some((term) => normalizedKey.includes(term))) {
          extracted[nextPath.join('.')] = child;
          continue;
        }

        if (child && typeof child === 'object' && !Array.isArray(child)) {
          visit(child, nextPath);
        }
      }
    };

    visit(output, []);
    return Object.keys(extracted).length > 0 ? extracted : null;
  }

  /**
   * Extract JSON from an LLM response that may contain markdown code blocks.
   */
  private extractJson(content: string): unknown {
    if (!content.trim()) return null;

    // Try direct parse
    try {
      return JSON.parse(content);
    } catch {
      // Try extracting from ```json ... ``` blocks
      const jsonBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (jsonBlockMatch) {
        try {
          return JSON.parse(jsonBlockMatch[1]);
        } catch {
          // Sanitize: fix unescaped control characters inside string values then retry
          try {
            return JSON.parse(this.sanitizeJsonString(jsonBlockMatch[1]));
          } catch {
            // Fall through to raw text
          }
        }
      }
      // Return raw text if no JSON found or unfixable
      return content;
    }
  }

  /**
   * Fix literal newlines/carriage-returns/tabs that appear inside JSON string values.
   * Uses a simple state machine to avoid touching whitespace outside strings.
   */
  private sanitizeJsonString(json: string): string {
    let result = '';
    let inString = false;
    let prevBackslashes = 0;

    for (let i = 0; i < json.length; i++) {
      const ch = json[i];

      if (ch === '"') {
        // A quote is a string delimiter only if preceded by an even number of backslashes
        if (prevBackslashes % 2 === 0) {
          inString = !inString;
        }
        result += ch;
        prevBackslashes = 0;
      } else if (ch === '\\') {
        result += ch;
        prevBackslashes += 1;
      } else if (inString) {
        prevBackslashes = 0;
        switch (ch) {
          case '\n': result += '\\n'; break;
          case '\r': result += '\\r'; break;
          case '\t': result += '\\t'; break;
          default:   result += ch;
        }
      } else {
        result += ch;
        prevBackslashes = 0;
      }
    }

    return result;
  }
}
