import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicChatOptions {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }>;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AnthropicToolDef[];
  thinkingBudget?: number;
}

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicChatResult {
  content: string | null;
  toolUse: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  thinkingContent: string | null;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: { inputTokens: number; outputTokens: number };
}

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly client: Anthropic;
  private readonly defaultModel: string;

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    this.client = new Anthropic({ apiKey });
    this.defaultModel = this.config.get<string>('ANTHROPIC_DEFAULT_MODEL', 'claude-opus-4-20250514');
  }

  async chat(options: AnthropicChatOptions): Promise<AnthropicChatResult> {
    const model = options.model ?? this.defaultModel;
    this.logger.debug(`Anthropic API: messages (model=${model})`);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= AnthropicService.MAX_RETRIES; attempt++) {
      try {
        const params: Anthropic.MessageCreateParams = {
          model,
          max_tokens: options.maxTokens ?? 8192,
          messages: options.messages as Anthropic.MessageCreateParams['messages'],
        };

        if (options.system) {
          params.system = options.system;
        }

        if (options.temperature !== undefined) {
          params.temperature = options.temperature;
        }

        if (options.tools?.length) {
          params.tools = options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema as Anthropic.Tool.InputSchema,
          }));
        }

        // Extended thinking support
        if (options.thinkingBudget && options.thinkingBudget > 0) {
          params.thinking = {
            type: 'enabled',
            budget_tokens: options.thinkingBudget,
          };
          // Temperature must be 1 when thinking is enabled
          delete params.temperature;
        }

        const response = await this.client.messages.create(params) as Anthropic.Message;

        return this.parseResponse(response);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Retry on rate limit (429) or server errors (5xx)
        const status = (error as { status?: number }).status;
        if (status === 429 || (status && status >= 500)) {
          const delay = AnthropicService.RETRY_DELAY_MS * Math.pow(2, attempt);
          this.logger.warn(`Anthropic API error (attempt ${attempt + 1}): ${status}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Anthropic API call failed after retries');
  }

  private parseResponse(response: Anthropic.Message): AnthropicChatResult {
    let content: string | null = null;
    let thinkingContent: string | null = null;
    const toolUse: AnthropicChatResult['toolUse'] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content = (content ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolUse.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      } else if (block.type === 'thinking') {
        thinkingContent = (thinkingContent ?? '') + (block as { thinking?: string }).thinking;
      }
    }

    return {
      content,
      toolUse,
      thinkingContent,
      stopReason: response.stop_reason as AnthropicChatResult['stopReason'],
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
