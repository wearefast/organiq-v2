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

  private static readonly MAX_RETRIES = 3;

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

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= OpenAiService.MAX_RETRIES; attempt++) {
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
        const errorBody = await response.text();
        this.logger.error(`OpenAI API error: ${response.status}`, errorBody);

        // Retry on rate limit (429) and server errors (5xx)
        if ((response.status === 429 || response.status >= 500) && attempt < OpenAiService.MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 1000;
          this.logger.warn(`OpenAI retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${OpenAiService.MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          lastError = new Error(`OpenAI API error: ${response.status}`);
          continue;
        }

        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: ChatMessage; finish_reason: string }>;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      if (!data.choices || !data.choices[0]) {
        throw new Error('OpenAI API returned an invalid response: missing choices');
      }

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

    // All retries exhausted
    throw lastError ?? new Error('OpenAI API request failed after retries');
  }

  // ─── AI Brand Inference ────────────────────────────────────────────────────

  /**
   * Sends a natural-language query to GPT-4o-mini and checks whether a brand
   * appears in the response — simulating what a real user would see from an AI
   * assistant. Used by the AI Intelligence agent to measure actual AI presence.
   */
  async inferAiBrandMention(query: string, brand: string): Promise<{
    query: string;
    mentioned: boolean;
    position: 'featured' | 'cited' | 'listed' | 'absent';
    mentionContext: string | null;
    aiResponse: string;
  }> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const body = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Answer the user\'s question naturally and thoroughly, as you would to any user.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0.5,
      max_tokens: 600,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI inference error: ${response.status} — ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const aiResponse = data.choices[0]?.message?.content ?? '';
    const brandLower = brand.toLowerCase();
    const responseLower = aiResponse.toLowerCase();
    const mentioned = responseLower.includes(brandLower);

    let position: 'featured' | 'cited' | 'listed' | 'absent' = 'absent';
    let mentionContext: string | null = null;

    if (mentioned) {
      const idx = responseLower.indexOf(brandLower);
      // Extract ~150 chars around the mention for context
      const start = Math.max(0, idx - 80);
      const end = Math.min(aiResponse.length, idx + brand.length + 80);
      mentionContext = `...${aiResponse.slice(start, end).trim()}...`;

      // Determine position quality
      const firstSentenceEnd = aiResponse.search(/[.!?]/);
      const firstSentence = firstSentenceEnd > -1 ? aiResponse.slice(0, firstSentenceEnd) : aiResponse.slice(0, 120);
      if (firstSentence.toLowerCase().includes(brandLower)) {
        position = 'featured';
      } else if (/[-•*]\s/.test(aiResponse.slice(Math.max(0, idx - 5), idx + 5))) {
        position = 'listed';
      } else {
        position = 'cited';
      }
    }

    return { query, mentioned, position, mentionContext, aiResponse };
  }

  // ─── Natural Query Generation ──────────────────────────────────────────────

  /**
   * Generates 5 natural, human-like search queries that a real person would
   * type into an AI assistant when looking for a business like this one.
   * Used to test AI brand visibility with realistic prompts.
   */
  async generateNaturalBrandQueries(context: {
    brand: string;
    category: string;
    market: string;
    competitor?: string;
    icpIndustry?: string;
  }): Promise<string[]> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const { brand, category, market, competitor, icpIndustry } = context;
    const currentYear = new Date().getFullYear();

    const prompt = `You are simulating how real humans prompt AI assistants (ChatGPT, Perplexity, Claude) when searching for products or services.

Given this business context:
- Brand: ${brand}
- Industry/Category: ${category}
- Primary Market: ${market}${competitor ? `\n- Key Competitor: ${competitor}` : ''}${icpIndustry ? `\n- Target Customer Industry: ${icpIndustry}` : ''}

Generate exactly 5 natural search queries that a real person would type into an AI chatbot. These should:
1. Sound like casual human language (short, conversational, sometimes with typos-level informality)
2. Use common/colloquial terms instead of industry jargon
3. Reference specific locations naturally (city names, not "region / sub-region")
4. Include a mix of: discovery queries, comparison queries, review queries, and recommendation queries
5. NOT use formal industry classification names — simplify them to how a normal person would say it

Examples of BAD queries (too formal):
- "best Coupon & Deals Aggregation / Affiliate Marketing in UAE / Middle East"
- "top Digital Marketing Solutions providers 2025"

Examples of GOOD queries (natural):
- "best coupon apps in Dubai"
- "where to find online deals in UAE"
- "is [brand] worth it"
- "what's better [brand] or [competitor]"

Return ONLY a JSON array of 5 strings. No explanation.`;

    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI query generation error: ${response.status} — ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content ?? '[]';

    try {
      const parsed = JSON.parse(content.replace(/```json?\n?|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length >= 5) {
        return parsed.slice(0, 5);
      }
    } catch {
      this.logger.warn('Failed to parse natural brand queries response, using fallback');
    }

    // Fallback: return simplified templates if LLM generation fails
    return [
      `best ${category.split('/')[0].trim().toLowerCase()} in ${market.split('/')[0].trim()}`,
      `${brand} review ${currentYear}`,
      competitor ? `${brand} vs ${competitor}` : `top ${category.split('/')[0].trim().toLowerCase()} ${currentYear}`,
      `is ${brand} good`,
      `recommend ${category.split('/')[0].trim().toLowerCase()} for ${icpIndustry ?? 'my business'}`,
    ];
  }

  // ─── Image Generation ─────────────────────────────────────────────────────

  async generateImage(
    prompt: string,
    size: '1024x1024' | '1536x1024' | '1024x1536' | '1792x1024' | '1024x1792' = '1536x1024',
  ): Promise<{ base64: string; revisedPrompt: string }> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not configured');

    // Map legacy dall-e-3 sizes to gpt-image-1 equivalents
    const normalizedSize =
      size === '1792x1024' ? '1536x1024' :
      size === '1024x1792' ? '1024x1536' :
      size;

    this.logger.debug(`OpenAI API: images/generations (size=${normalizedSize})`);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= OpenAiService.MAX_RETRIES; attempt++) {
      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size: normalizedSize,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`OpenAI Images API error: ${response.status}`, errorBody);

        if ((response.status === 429 || response.status >= 500) && attempt < OpenAiService.MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 1000;
          this.logger.warn(`OpenAI Images retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${OpenAiService.MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          lastError = new Error(`OpenAI Images API error: ${response.status}`);
          continue;
        }

        throw new Error(`OpenAI Images API error: ${response.status} — ${errorBody}`);
      }

      const data = (await response.json()) as {
        data: Array<{ url?: string; b64_json?: string; revised_prompt: string }>;
      };

      if (!data.data?.[0]) {
        throw new Error('OpenAI Images API returned an invalid response');
      }

      const item = data.data[0];
      const revisedPrompt = item.revised_prompt ?? '';

      // API now returns a URL by default — fetch it and convert to base64
      if (item.url) {
        const imgResponse = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
        if (!imgResponse.ok) {
          throw new Error(`Failed to download generated image: ${imgResponse.status}`);
        }
        const arrayBuffer = await imgResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return { base64, revisedPrompt };
      }

      // Fallback: b64_json still present (older API versions)
      if (item.b64_json) {
        return { base64: item.b64_json, revisedPrompt };
      }

      throw new Error('OpenAI Images API returned neither url nor b64_json');
    }

    throw lastError ?? new Error('OpenAI Images API request failed after retries');
  }
}
