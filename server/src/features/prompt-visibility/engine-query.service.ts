import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Types ───────────────────────────────────────────────────

export interface EngineResponse {
  engine: string;
  text: string;
  citations?: string[];
  error?: string;
}

export const SUPPORTED_ENGINES = ['perplexity', 'openai', 'gemini', 'claude', 'copilot'] as const;
export type SupportedEngine = (typeof SUPPORTED_ENGINES)[number];

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class EngineQueryService {
  private readonly logger = new Logger(EngineQueryService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Query a single engine with a prompt. Runs 3 times for majority vote.
   * Returns the response where brand-mention is most consistent.
   */
  async queryWithMajorityVote(engine: SupportedEngine, prompt: string): Promise<EngineResponse> {
    const results: EngineResponse[] = [];

    for (let i = 0; i < 3; i++) {
      try {
        const response = await this.queryEngine(engine, prompt);
        results.push(response);
      } catch (e) {
        this.logger.warn(`Engine ${engine} attempt ${i + 1} failed: ${e}`);
        results.push({ engine, text: '', error: String(e) });
      }
    }

    // Return the longest successful response (most content to parse)
    const successful = results.filter((r) => !r.error && r.text.length > 0);
    if (successful.length === 0) {
      return { engine, text: '', error: 'All 3 attempts failed' };
    }

    return successful.sort((a, b) => b.text.length - a.text.length)[0];
  }

  /**
   * Query a single engine once.
   */
  async queryEngine(engine: SupportedEngine, prompt: string): Promise<EngineResponse> {
    switch (engine) {
      case 'perplexity':
        return this.queryPerplexity(prompt);
      case 'openai':
        return this.queryOpenAI(prompt);
      case 'gemini':
        return this.queryGemini(prompt);
      case 'claude':
        return this.queryClaude(prompt);
      case 'copilot':
        return this.queryCopilot(prompt);
      default:
        return { engine, text: '', error: `Unsupported engine: ${engine}` };
    }
  }

  // ─── Perplexity ──────────────────────────────────────────

  private async queryPerplexity(prompt: string): Promise<EngineResponse> {
    const apiKey = this.config.get<string>('PERPLEXITY_API_KEY');
    if (!apiKey) return { engine: 'perplexity', text: '', error: 'No API key configured' };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };
    return {
      engine: 'perplexity',
      text: data.choices?.[0]?.message?.content ?? '',
      citations: data.citations,
    };
  }

  // ─── OpenAI (with web search) ────────────────────────────

  private async queryOpenAI(prompt: string): Promise<EngineResponse> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return { engine: 'openai', text: '', error: 'No API key configured' };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search' as const }],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return {
      engine: 'openai',
      text: data.choices?.[0]?.message?.content ?? '',
    };
  }

  // ─── Gemini ──────────────────────────────────────────────

  private async queryGemini(prompt: string): Promise<EngineResponse> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) return { engine: 'gemini', text: '', error: 'No API key configured' };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return { engine: 'gemini', text };
  }

  // ─── Claude ──────────────────────────────────────────────

  private async queryClaude(prompt: string): Promise<EngineResponse> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return { engine: 'claude', text: '', error: 'No API key configured' };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') ?? '';
    return { engine: 'claude', text };
  }

  // ─── Copilot (Bing) — fallback to web search ─────────────

  private async queryCopilot(prompt: string): Promise<EngineResponse> {
    // Microsoft Copilot doesn't have a public API; use Bing Web Search as proxy
    const apiKey = this.config.get<string>('BING_SEARCH_API_KEY');
    if (!apiKey) return { engine: 'copilot', text: '', error: 'No API key configured' };

    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(prompt)}&count=5`,
      {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      },
    );

    if (!response.ok) {
      throw new Error(`Bing API ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      webPages?: { value: Array<{ name: string; snippet: string; url: string }> };
    };
    const snippets = data.webPages?.value?.map((r) => `${r.name}: ${r.snippet}`).join('\n') ?? '';
    const citations = data.webPages?.value?.map((r) => r.url) ?? [];
    return { engine: 'copilot', text: snippets, citations };
  }
}
