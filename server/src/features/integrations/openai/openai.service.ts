import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  tools?: ToolDefinition[];
  maxTokens?: number;
}

interface ChatCompletionResult {
  message: ChatMessage;
  finishReason: 'stop' | 'tool_calls' | 'length';
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '');
    this.defaultModel = this.config.get<string>('OPENAI_MODEL', 'gpt-4o');
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const body: Record<string, unknown> = {
      model: options.model ?? this.defaultModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
    };

    if (options.tools?.length) {
      body.tools = options.tools;
    }

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    this.logger.debug(`OpenAI API: chat/completions (model=${body.model})`);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`OpenAI API error: ${response.status}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: ChatMessage; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = data.choices[0];

    return {
      message: choice.message,
      finishReason: choice.finish_reason as ChatCompletionResult['finishReason'],
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }
}
