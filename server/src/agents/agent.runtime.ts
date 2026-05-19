import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { LlmProvider, LlmMessage, LlmToolDef } from './llm-provider.interface';
import { ToolRegistry } from './tool.registry';
import { ToolSandbox } from './tool.sandbox';

interface AgentConfig {
  name: string;
  model: string;
  temperature: number;
  maxIterations: number;
  tools: string[];
  systemPrompt: string;
  userPrompt: string;
  provider?: 'openai' | 'anthropic';
  tier?: 'tier1' | 'tier2' | 'tier3';
  thinkingBudget?: number;
}

interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  success: boolean;
}

interface AgentResult {
  output: unknown;
  reasoning: string;
  toolCalls: ToolCallRecord[];
  iterations: number;
  totalTokens: number;
  finishReason: 'completed' | 'max_iterations' | 'error';
  error?: string;
  thinkingContent?: string | null;
}

@Injectable()
export class AgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);
  private static readonly AGENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly TOOL_TIMEOUT_MS = 60 * 1000; // 60 seconds per tool call
  private readonly providers: Map<string, LlmProvider>;
  private readonly providerOverride: string | undefined;

  constructor(
    private readonly openAiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly toolRegistry: ToolRegistry,
    private readonly toolSandbox: ToolSandbox,
    private readonly configService: ConfigService,
  ) {
    this.providers = new Map<string, LlmProvider>([
      ['openai', this.openAiProvider],
      ['anthropic', this.anthropicProvider],
    ]);
    this.providerOverride = this.configService.get<string>('AGENT_PROVIDER_OVERRIDE');
  }

  private resolveProvider(config: AgentConfig): LlmProvider {
    const name = this.providerOverride ?? config.provider ?? 'openai';
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Unknown LLM provider: ${name}`);
    return provider;
  }

  /**
   * Execute an agent's function-calling loop with an overall timeout.
   * Iterates until the agent produces a final content response or hits max iterations.
   */
  async execute(config: AgentConfig): Promise<AgentResult> {
    let timer: ReturnType<typeof setTimeout>;
    const result = await Promise.race([
      this.executeLoop(config),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Agent "${config.name}" timed out after ${AgentRuntime.AGENT_TIMEOUT_MS / 1000}s`)),
          AgentRuntime.AGENT_TIMEOUT_MS,
        );
      }),
    ]);
    clearTimeout(timer!);
    return result;
  }

  private async executeLoop(config: AgentConfig): Promise<AgentResult> {
    const toolCalls: ToolCallRecord[] = [];
    let totalTokens = 0;
    let iterations = 0;
    const provider = this.resolveProvider(config);

    // Tier 2: single-shot, no tool loop
    if (config.tier === 'tier2') {
      return this.executeTier2(config, provider);
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: config.userPrompt },
    ];

    const tools: LlmToolDef[] | undefined = config.tools.length > 0
      ? this.toolRegistry.getOpenAiToolDefs(config.tools).map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        }))
      : undefined;

    while (iterations < config.maxIterations) {
      iterations++;
      this.logger.debug(`Agent "${config.name}" iteration ${iterations}/${config.maxIterations} [${provider.name}]`);

      const result = await provider.complete({
        messages,
        model: config.model,
        temperature: config.temperature,
        tools,
        thinkingBudget: config.thinkingBudget,
      });

      totalTokens += result.usage.totalTokens;

      if (result.finishReason === 'tool_calls' && result.toolCalls.length > 0) {
        // Process tool calls
        messages.push({
          role: 'assistant',
          content: result.content,
          toolCalls: result.toolCalls,
        });

        for (const tc of result.toolCalls) {
          const toolName = tc.name;
          let input: unknown;

          try {
            input = JSON.parse(tc.arguments);
          } catch {
            input = tc.arguments;
          }

          const start = Date.now();
          let toolTimer: ReturnType<typeof setTimeout>;
          const sandboxResult = await Promise.race([
            this.toolSandbox.execute(config.tools, toolName, input),
            new Promise<{ success: false; error: string }>((resolve) => {
              toolTimer = setTimeout(
                () => resolve({ success: false, error: `Tool "${toolName}" timed out after ${AgentRuntime.TOOL_TIMEOUT_MS / 1000}s` }),
                AgentRuntime.TOOL_TIMEOUT_MS,
              );
            }),
          ]);
          clearTimeout(toolTimer!);
          const durationMs = Date.now() - start;

          toolCalls.push({
            toolName,
            input,
            output: sandboxResult.success ? sandboxResult.result : sandboxResult.error,
            durationMs,
            success: sandboxResult.success,
          });

          const toolContent = JSON.stringify(sandboxResult.success ? sandboxResult.result : { error: sandboxResult.error });
          const MAX_TOOL_RESULT_CHARS = 8000;
          const cappedContent = toolContent.length > MAX_TOOL_RESULT_CHARS
            ? toolContent.slice(0, MAX_TOOL_RESULT_CHARS) + `... [truncated, ${toolContent.length} chars total]`
            : toolContent;
          messages.push({
            role: 'tool',
            toolCallId: tc.id,
            content: cappedContent,
          });
        }

        continue;
      }

      // Check for token limit truncation
      if (result.finishReason === 'length') {
        this.logger.warn(`Agent "${config.name}" response truncated (token limit hit) at iteration ${iterations}`);
        return {
          output: null,
          reasoning: 'Response truncated: token limit reached',
          toolCalls,
          iterations,
          totalTokens,
          finishReason: 'error',
          error: 'Token limit reached — response was truncated',
        };
      }

      // Agent returned a content response — extract output
      const content = result.content ?? '';

      try {
        const parsed = this.extractJson(content);
        const reasoning = content
          .replace(/```(?:json)?\s*\n[\s\S]*?\n```/g, '')
          .replace(/^\s*\{[\s\S]*\}\s*$/, '')
          .trim() || 'Output produced successfully.';
        return {
          output: parsed,
          reasoning,
          toolCalls,
          iterations,
          totalTokens,
          finishReason: 'completed',
          thinkingContent: result.thinkingContent,
        };
      } catch {
        return {
          output: content,
          reasoning: content,
          toolCalls,
          iterations,
          totalTokens,
          finishReason: 'completed',
          thinkingContent: result.thinkingContent,
        };
      }
    }

    // Hit max iterations without producing output
    this.logger.warn(`Agent "${config.name}" hit max iterations (${config.maxIterations})`);
    return {
      output: null,
      reasoning: 'Max iterations reached without producing final output',
      toolCalls,
      iterations,
      totalTokens,
      finishReason: 'max_iterations',
    };
  }

  /**
   * Tier 2 execution: single-shot with extended thinking, no tool loop.
   */
  private async executeTier2(config: AgentConfig, provider: LlmProvider): Promise<AgentResult> {
    this.logger.debug(`Agent "${config.name}" executing Tier 2 (single-shot) [${provider.name}]`);

    const result = await provider.completeTier2({
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: config.userPrompt },
      ],
      model: config.model,
      temperature: config.temperature,
      thinkingBudget: config.thinkingBudget,
    });

    const content = result.content ?? '';

    try {
      const parsed = this.extractJson(content);
      const reasoning = content
        .replace(/```(?:json)?\s*\n[\s\S]*?\n```/g, '')
        .replace(/^\s*\{[\s\S]*\}\s*$/, '')
        .trim() || 'Output produced successfully.';
      return {
        output: parsed,
        reasoning,
        toolCalls: [],
        iterations: 1,
        totalTokens: result.usage.totalTokens,
        finishReason: 'completed',
        thinkingContent: result.thinkingContent,
      };
    } catch {
      return {
        output: content,
        reasoning: content,
        toolCalls: [],
        iterations: 1,
        totalTokens: result.usage.totalTokens,
        finishReason: 'completed',
        thinkingContent: result.thinkingContent,
      };
    }
  }

  /**
   * Extract JSON from an LLM response that may contain markdown code blocks.
   */
  private extractJson(content: string): unknown {
    // Try direct parse
    try {
      return JSON.parse(content);
    } catch {
      // Try extracting from ```json ... ``` blocks
      const jsonBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (jsonBlockMatch) {
        return JSON.parse(jsonBlockMatch[1]);
      }
      throw new Error('No valid JSON found in response');
    }
  }
}
