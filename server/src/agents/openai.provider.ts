import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../features/integrations/openai/openai.service';
import {
  LlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
} from './llm-provider.interface';

/**
 * OpenAI provider adapter.
 * Wraps the existing OpenAiService to implement the LlmProvider interface.
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai' as const;

  constructor(private readonly openai: OpenAiService) {}

  async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const messages = this.convertMessages(options.messages);
    const tools = options.tools?.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const result = await this.openai.chatCompletion({
      messages,
      model: options.model,
      temperature: options.temperature,
      tools,
      maxTokens: options.maxTokens,
    });

    return {
      content: result.message.content,
      toolCalls: (result.message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
      finishReason: result.finishReason === 'tool_calls' ? 'tool_calls' : result.finishReason === 'length' ? 'length' : 'stop',
      thinkingContent: null,
      usage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
    };
  }

  async completeTier2(options: Omit<LlmCompletionOptions, 'tools'>): Promise<LlmCompletionResult> {
    // For OpenAI, Tier 2 is just a normal completion without tools
    return this.complete({ ...options, tools: undefined });
  }

  private convertMessages(messages: LlmMessage[]) {
    return messages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }
      if (m.toolCallId) {
        msg.tool_call_id = m.toolCallId;
      }
      return msg as any;
    });
  }
}
