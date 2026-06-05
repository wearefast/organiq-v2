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
  /** AbortSignal to cancel the in-flight SDK call (e.g. on step timeout). */
  signal?: AbortSignal;
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

export interface AiBrandMentionResult {
  query: string;
  mentioned: boolean;
  position: number | null;
  mentionContext: string;
  aiResponse: string;
  provider: 'anthropic';
}

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly client: Anthropic;
  private readonly defaultModel: string;

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  private static readonly MODEL_ALIASES: Record<string, string> = {
    'claude-opus-4': 'claude-opus-4-6',
    'claude-sonnet-4': 'claude-sonnet-4-6',
  };

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    this.client = new Anthropic({ apiKey });
    this.defaultModel = this.config.get<string>('ANTHROPIC_DEFAULT_MODEL', 'claude-opus-4-6');
  }

  async chat(options: AnthropicChatOptions): Promise<AnthropicChatResult> {
    const rawModel = options.model ?? this.defaultModel;
    const model = AnthropicService.MODEL_ALIASES[rawModel] ?? rawModel;
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

        const response = await this.client.messages.create(params, { signal: options.signal }) as Anthropic.Message;

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

  async inferAiBrandMention(query: string, brand: string): Promise<AiBrandMentionResult> {
    const result = await this.chat({
      messages: [{ role: 'user', content: query }],
      maxTokens: 2048,
    });

    const aiResponse = result.content ?? '';
    const lowerResponse = aiResponse.toLowerCase();
    const lowerBrand = brand.toLowerCase();
    const mentioned = lowerResponse.includes(lowerBrand);
    let position: number | null = null;
    let mentionContext = '';

    if (mentioned) {
      const idx = lowerResponse.indexOf(lowerBrand);
      const relativePos = idx / Math.max(lowerResponse.length, 1);
      position = relativePos < 0.2 ? 1 : relativePos < 0.4 ? 2 : relativePos < 0.6 ? 3 : relativePos < 0.8 ? 4 : 5;
      const start = Math.max(0, idx - 100);
      const end = Math.min(aiResponse.length, idx + brand.length + 100);
      mentionContext = aiResponse.slice(start, end).trim();
    }

    return { query, mentioned, position, mentionContext, aiResponse, provider: 'anthropic' };
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
