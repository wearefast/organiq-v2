import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiUsageContextService } from '../../api-usage/api-usage-context.service';
import { ApiUsageService } from '../../api-usage/api-usage.service';
import { perplexityCostUsd } from '../../api-usage/pricing.constants';

export interface PerplexityChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityChatOptions {
  model?: string;
  messages: PerplexityChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Enable web search (sonar models only). Default true for sonar. */
  searchEnabled?: boolean;
}

export interface PerplexityChatResult {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Cited sources (web search results) returned by sonar models. */
  citations?: string[];
}

/**
 * Perplexity AI integration service.
 * Uses the OpenAI-compatible API at https://api.perplexity.ai.
 *
 * Available models:
 *   sonar            — Fast, internet-grounded (web search)
 *   sonar-pro        — Deep research, internet-grounded
 *   sonar-deep-research — Extended reasoning with citations
 *   r1-1776          — Offline reasoning, no web search
 *
 * Set PERPLEXITY_API_KEY in environment to enable.
 */
@Injectable()
export class PerplexityService {
  private readonly logger = new Logger(PerplexityService.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl = 'https://api.perplexity.ai';

  private static readonly MAX_RETRIES = 2;

  constructor(
    private readonly config: ConfigService,
    private readonly apiUsageContext: ApiUsageContextService,
    private readonly apiUsageService: ApiUsageService,
  ) {
    this.apiKey = this.config.get<string>('PERPLEXITY_API_KEY', '');
    this.defaultModel = this.config.get<string>('PERPLEXITY_DEFAULT_MODEL', 'sonar');
  }

  async chat(options: PerplexityChatOptions): Promise<PerplexityChatResult> {
    if (!this.apiKey) throw new Error('PERPLEXITY_API_KEY is not configured');

    const model = options.model ?? this.defaultModel;
    this.logger.debug(`Perplexity API: chat/completions (model=${model})`);
    const callStart = Date.now();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= PerplexityService.MAX_RETRIES; attempt++) {
      const body: Record<string, unknown> = {
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Perplexity API error: ${response.status}`, errorText.slice(0, 300));

        if ((response.status === 429 || response.status >= 500) && attempt < PerplexityService.MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          this.logger.warn(`Perplexity retrying in ${delay}ms (attempt ${attempt + 1}/${PerplexityService.MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          lastError = new Error(`Perplexity API error: ${response.status}`);
          continue;
        }

        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number };
        citations?: string[];
      };

      if (!data.choices?.[0]) {
        throw new Error('Perplexity API returned an invalid response: missing choices');
      }

      const durationMs = Date.now() - callStart;
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;

      // Record API usage — fire-and-forget
      const ctx = this.apiUsageContext.getContext();
      if (ctx) {
        this.apiUsageService.record({
          organizationId: ctx.organizationId,
          projectId: ctx.projectId,
          workflowRunId: ctx.workflowRunId,
          stepKey: ctx.stepKey,
          provider: 'perplexity',
          endpoint: model,
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          costUsd: perplexityCostUsd(model, inputTokens, outputTokens),
          durationMs,
          success: true,
        });
      }

      return {
        content: data.choices[0].message.content,
        model: data.model ?? model,
        usage: { inputTokens, outputTokens },
        citations: data.citations,
      };
    }

    throw lastError ?? new Error('Perplexity API call failed after retries');
  }
}
