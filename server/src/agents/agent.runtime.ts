import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../features/integrations/openai/openai.service';
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
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

@Injectable()
export class AgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);

  constructor(
    private readonly openai: OpenAiService,
    private readonly toolRegistry: ToolRegistry,
    private readonly toolSandbox: ToolSandbox,
  ) {}

  /**
   * Execute an agent's function-calling loop.
   * Iterates until the agent produces a final content response or hits max iterations.
   */
  async execute(config: AgentConfig): Promise<AgentResult> {
    const toolCalls: ToolCallRecord[] = [];
    let totalTokens = 0;
    let iterations = 0;

    const messages: ChatMessage[] = [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: config.userPrompt },
    ];

    const openAiTools = config.tools.length > 0
      ? this.toolRegistry.getOpenAiToolDefs(config.tools)
      : undefined;

    while (iterations < config.maxIterations) {
      iterations++;
      this.logger.debug(`Agent "${config.name}" iteration ${iterations}/${config.maxIterations}`);

      const result = await this.openai.chatCompletion({
        messages,
        model: config.model,
        temperature: config.temperature,
        tools: openAiTools,
      });

      totalTokens += result.usage.totalTokens;

      if (result.finishReason === 'tool_calls' && result.message.tool_calls?.length) {
        // Process tool calls
        messages.push(result.message);

        for (const tc of result.message.tool_calls) {
          const toolName = tc.function.name;
          let input: unknown;

          try {
            input = JSON.parse(tc.function.arguments);
          } catch {
            input = tc.function.arguments;
          }

          const start = Date.now();
          const sandboxResult = await this.toolSandbox.execute(config.tools, toolName, input);
          const durationMs = Date.now() - start;

          toolCalls.push({
            toolName,
            input,
            output: sandboxResult.success ? sandboxResult.result : sandboxResult.error,
            durationMs,
            success: sandboxResult.success,
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(sandboxResult.success ? sandboxResult.result : { error: sandboxResult.error }),
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
      const content = result.message.content ?? '';

      try {
        const parsed = this.extractJson(content);
        return {
          output: parsed,
          reasoning: content,
          toolCalls,
          iterations,
          totalTokens,
          finishReason: 'completed',
        };
      } catch {
        // Content is not valid JSON — return raw
        return {
          output: content,
          reasoning: content,
          toolCalls,
          iterations,
          totalTokens,
          finishReason: 'completed',
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
