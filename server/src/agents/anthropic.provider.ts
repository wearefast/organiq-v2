import { Injectable } from '@nestjs/common';
import { AnthropicService } from '../features/integrations/anthropic/anthropic.service';
import {
  LlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
} from './llm-provider.interface';

/**
 * Anthropic provider adapter.
 * Wraps AnthropicService to implement the LlmProvider interface.
 * Supports extended thinking for Tier 2 agents.
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic' as const;

  constructor(private readonly anthropic: AnthropicService) {}

  async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const { system, messages } = this.convertMessages(options.messages);

    const tools = options.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const result = await this.anthropic.chat({
      messages,
      system,
      model: options.model,
      temperature: options.temperature,
      tools,
      maxTokens: options.maxTokens,
      thinkingBudget: options.thinkingBudget,
    });

    return {
      content: result.content,
      toolCalls: result.toolUse.map((tu) => ({
        id: tu.id,
        name: tu.name,
        arguments: JSON.stringify(tu.input),
      })),
      finishReason: result.stopReason === 'tool_use' ? 'tool_calls' : result.stopReason === 'max_tokens' ? 'length' : 'stop',
      thinkingContent: result.thinkingContent,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.inputTokens + result.usage.outputTokens,
      },
    };
  }

  async completeTier2(options: Omit<LlmCompletionOptions, 'tools'>): Promise<LlmCompletionResult> {
    // For Tier 2, enable extended thinking (no tools)
    return this.complete({
      ...options,
      tools: undefined,
      thinkingBudget: options.thinkingBudget ?? 32_000,
    });
  }

  /**
   * Convert LlmMessage[] to Anthropic format.
   * Anthropic uses a separate `system` param and only user/assistant messages.
   * Tool results are sent as user messages with tool_result content blocks.
   */
  private convertMessages(messages: LlmMessage[]): {
    system: string | undefined;
    messages: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }>;
  } {
    let system: string | undefined;
    const converted: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = (system ?? '') + (msg.content ?? '');
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        converted.push({ role: msg.role, content: msg.content ?? '' });
      } else if (msg.role === 'tool') {
        // Tool results as proper content blocks for Anthropic API
        converted.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId,
              content: msg.content ?? '',
            },
          ],
        });
      }
    }

    return { system, messages: converted };
  }
}
