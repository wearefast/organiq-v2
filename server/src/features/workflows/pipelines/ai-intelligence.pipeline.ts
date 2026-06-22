import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pipeline } from './pipeline.interface';
import { FirecrawlService } from '../../integrations/firecrawl/firecrawl.service';
import { SerperService } from '../../integrations/serper/serper.service';
import { OpenAiService } from '../../integrations/openai/openai.service';
import { AnthropicService } from '../../integrations/anthropic/anthropic.service';

interface BusinessProfile {
  business_name?: string;
  industry?: string;
  primary_market?: string;
  primary_services?: string[];
  icp?: { description?: string; industries?: string[] };
  competitors?: Array<{ name: string; type?: string }>;
  sitemap_urls?: string[];
}

interface PlatformMentionResult {
  platform: 'openai' | 'anthropic' | 'perplexity';
  mentioned: boolean;
  position: string | null;
  mentionContext: string | null;
  fullResponseTruncated: string;
}

/**
 * AiIntelligencePipeline
 *
 * Replaces the agent-with-tools loop for ai-intelligence. All data gathering
 * now runs in parallel via Promise.allSettled:
 *
 *   Phase 1 — Content & structure (firecrawl × 2)
 *     – Homepage scrape
 *     – Second key page (first non-homepage sitemap URL, or skip)
 *
 *   Phase 2 — AI visibility test (openai_ai_inference × 5)
 *     – Templated queries constructed from the business profile
 *
 *   Phase 3 — SERP & competitive context (serper × 3)
 *     – "best [category] [market]"
 *     – "[brand] review"
 *     – "[brand] vs [competitor]"
 *
 * The LLM reasoning call then gets clean pre-fetched evidence and produces
 * the aiReadinessScore + aiMentions in a single pass.
 */
@Injectable()
export class AiIntelligencePipeline implements Pipeline {
  readonly stepKey = 'ai-intelligence';
  private readonly logger = new Logger(AiIntelligencePipeline.name);

  constructor(
    private readonly firecrawl: FirecrawlService,
    private readonly serper: SerperService,
    private readonly openai: OpenAiService,
    private readonly anthropic: AnthropicService,
    private readonly config: ConfigService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const start = Date.now();
    const errors: string[] = [];

    const domain = context.domain as string;
    const homepage = domain?.startsWith('http') ? domain : `https://${domain}`;
    const origin = new URL(homepage).origin;

    // Business profile carries brand / category / market / competitors
    const bp = (context['business-profile'] as BusinessProfile | undefined) ?? {};
    const brand = bp.business_name ?? domain ?? '';
    const category = bp.industry ?? bp.primary_services?.[0] ?? 'business';
    const market = bp.primary_market ?? 'global';
    const firstCompetitor =
      bp.competitors?.find((c) => c.type === 'direct')?.name ?? bp.competitors?.[0]?.name ?? '';
    const currentYear = new Date().getFullYear();

    // Second page: first non-homepage sitemap URL (best-effort)
    const sitemapUrls = (bp.sitemap_urls ?? []).filter(
      (u) => u && !u.replace(/\/$/, '').endsWith(origin.replace(/\/$/, '')),
    );
    const secondPageUrl = sitemapUrls[0] ?? null;

    this.logger.log(`ai-intelligence pipeline: analysing ${domain} (brand="${brand}", market="${market}")`);

    // Generate natural, human-like queries using LLM instead of rigid templates
    let naturalQueries: string[];
    try {
      naturalQueries = await this.openai.generateNaturalBrandQueries({
        brand,
        category,
        market,
        competitor: firstCompetitor || undefined,
        icpIndustry: bp.icp?.industries?.[0],
      });
    } catch (err) {
      this.logger.warn(`Failed to generate natural queries, using simplified fallback: ${(err as Error).message}`);
      const simpleCategory = category.split('/')[0].trim().toLowerCase();
      const simpleMarket = market.split('/')[0].trim();
      naturalQueries = [
        `best ${simpleCategory} in ${simpleMarket}`,
        `${brand} review ${currentYear}`,
        firstCompetitor ? `${brand} vs ${firstCompetitor}` : `top ${simpleCategory} ${currentYear}`,
        `is ${brand} good`,
        `recommend ${simpleCategory} for ${bp.icp?.industries?.[0] ?? 'my business'}`,
      ];
    }

    const aiQueries: Array<{ query: string; brand: string }> = naturalQueries.map((q) => ({
      query: q,
      brand,
    }));

    // business-profile pipeline already scraped homepage + /about + /services + /about-us.
    // Reuse those pages instead of re-scraping — they are exactly the high-value pages
    // needed for E-E-A-T / schema / content structure analysis.
    const bpPages = (bp as any).rawData?.scrapedPages as
      | Array<{ url: string; data: unknown }>
      | undefined;
    const homepageFromBP = bpPages?.find(
      (p) => p.data !== null && (p.url === homepage || p.url === origin || p.url === `${origin}/`),
    );
    const secondPageFromBP =
      bpPages?.find(
        (p) =>
          p.data !== null &&
          p.url !== homepage &&
          p.url !== origin &&
          p.url !== `${origin}/`,
      ) ?? null;

    // Only scrape if business-profile didn't already fetch the page
    const [homepageScrapeResult, secondPageScrapeResult] = await Promise.allSettled([
      homepageFromBP
        ? Promise.resolve(homepageFromBP.data)
        : this.firecrawl.scrape(homepage),
      secondPageFromBP
        ? Promise.resolve(secondPageFromBP.data)
        : secondPageUrl
          ? this.firecrawl.scrape(secondPageUrl)
          : Promise.resolve(null),
    ]);

    const usedHomepageFromBP = !!homepageFromBP;
    const usedSecondPageFromBP = !!secondPageFromBP;

    // Serper + multi-platform AI inference calls run fresh (brand/SERP context changes over time).
    // Each of the 5 natural queries is sent to OpenAI, Anthropic (Claude), and Perplexity in
    // parallel — 15 total inference calls interleaved as: openai_0, anthropic_0, perplexity_0, ...
    const [serpBestResult, serpReviewResult, serpVsResult, ...allMentionResults] =
      await Promise.allSettled([
        this.serper.search({ query: `best ${category} ${market}`, num: 8 }),
        this.serper.search({ query: `${brand} review`, num: 5 }),
        firstCompetitor
          ? this.serper.search({ query: `${brand} vs ${firstCompetitor}`, num: 5 })
          : Promise.resolve(null),
        ...aiQueries.flatMap((q) => [
          this.openai.inferAiBrandMention(q.query, q.brand),
          this.anthropic.inferAiBrandMention(q.query, q.brand),
          this.callPerplexity(q.query, q.brand),
        ]),
      ]);

    const extract = <T>(result: PromiseSettledResult<T>, label: string): T | null => {
      if (result.status === 'fulfilled') return result.value;
      const msg = `${label}: ${(result.reason as Error)?.message ?? String(result.reason)}`;
      this.logger.warn(`ai-intelligence pipeline error — ${msg}`);
      errors.push(msg);
      return null;
    };

    const normalizeMentionResult = (
      raw: unknown,
      platform: PlatformMentionResult['platform'],
    ): PlatformMentionResult => {
      if (!raw || typeof raw !== 'object') {
        return { platform, mentioned: false, position: null, mentionContext: null, fullResponseTruncated: '' };
      }
      const r = raw as Record<string, unknown>;
      const aiResponse = typeof r.aiResponse === 'string' ? r.aiResponse : '';
      // Anthropic uses a numeric position (1–5); OpenAI & Perplexity use semantic strings.
      const position = r.position != null ? String(r.position) : null;
      return {
        platform,
        mentioned: Boolean(r.mentioned),
        position: position === 'null' ? null : position,
        mentionContext: typeof r.mentionContext === 'string' ? r.mentionContext : null,
        fullResponseTruncated: aiResponse.slice(0, 300),
      };
    };

    // Group results: allMentionResults is interleaved as [openai_0, anthropic_0, perplexity_0, openai_1, ...]
    const aiMentions = aiQueries.map((q, i) => ({
      query: q.query,
      brand: q.brand,
      responses: [
        normalizeMentionResult(
          extract(allMentionResults[i * 3] as PromiseSettledResult<unknown>, `openai_query_${i}`),
          'openai',
        ),
        normalizeMentionResult(
          extract(allMentionResults[i * 3 + 1] as PromiseSettledResult<unknown>, `anthropic_query_${i}`),
          'anthropic',
        ),
        normalizeMentionResult(
          extract(allMentionResults[i * 3 + 2] as PromiseSettledResult<unknown>, `perplexity_query_${i}`),
          'perplexity',
        ),
      ],
    }));

    const successfulApiCalls =
      (homepageScrapeResult.status === 'fulfilled' && !usedHomepageFromBP ? 1 : 0) +
      (secondPageScrapeResult.status === 'fulfilled' && !usedSecondPageFromBP ? 1 : 0) +
      (serpBestResult.status === 'fulfilled' ? 1 : 0) +
      (serpReviewResult.status === 'fulfilled' ? 1 : 0) +
      (serpVsResult.status === 'fulfilled' ? 1 : 0) +
      allMentionResults.filter((r) => r.status === 'fulfilled').length;

    this.logger.log(
      `ai-intelligence pipeline: done — ${successfulApiCalls} fresh API calls (3 platforms × 5 queries), ${errors.length} errors, ${Date.now() - start}ms`,
    );

    // Build scrapedPages: homepage + additional pages from business-profile (free),
    // or fallback to freshly scraped second page if no business-profile pages available.
    const additionalPages: Array<{ url: string; data: unknown }> = bpPages
      ? bpPages
          .filter(
            (p) =>
              p.data !== null &&
              p.url !== homepage &&
              p.url !== origin &&
              p.url !== `${origin}/`,
          )
          .slice(0, 2)
          .map((p) => ({ url: p.url, data: p.data }))
      : secondPageUrl
        ? [{ url: secondPageUrl, data: extract(secondPageScrapeResult, 'firecrawl_second_page') }]
        : [];

    return {
      rawData: {
        scrapedPages: [
          { url: homepage, data: extract(homepageScrapeResult, 'firecrawl_homepage') },
          ...additionalPages,
        ],
        serpResults: {
          best: extract(serpBestResult, 'serper_best'),
          review: extract(serpReviewResult, 'serper_review'),
          vs: extract(serpVsResult, 'serper_vs'),
        },
        aiMentions,
      },
      metadata: {
        domain,
        brand,
        category,
        market,
        secondPageUrl,
        usedCachedPages: { homepage: usedHomepageFromBP, secondPage: usedSecondPageFromBP },
        aiQueriesRun: aiQueries.map((q) => q.query),
        platforms: ['openai', 'anthropic', 'perplexity'],
        successfulApiCalls,
        durationMs: Date.now() - start,
        errors,
      },
    };
  }

  // ─── Perplexity inline call (mirrors OpenAI inferAiBrandMention shape) ─────

  private async callPerplexity(query: string, brand: string): Promise<{
    query: string;
    mentioned: boolean;
    position: 'featured' | 'cited' | 'listed' | 'absent';
    mentionContext: string | null;
    aiResponse: string;
    provider: 'perplexity';
  }> {
    const apiKey = this.config.get<string>('PERPLEXITY_API_KEY', '');
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY is not configured');

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Answer the user\'s question naturally and thoroughly.',
          },
          { role: 'user', content: query },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Perplexity API ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const aiResponse = data.choices?.[0]?.message?.content ?? '';
    const brandLower = brand.toLowerCase();
    const responseLower = aiResponse.toLowerCase();
    const mentioned = responseLower.includes(brandLower);

    let position: 'featured' | 'cited' | 'listed' | 'absent' = 'absent';
    let mentionContext: string | null = null;

    if (mentioned) {
      const idx = responseLower.indexOf(brandLower);
      const start = Math.max(0, idx - 80);
      const end = Math.min(aiResponse.length, idx + brand.length + 80);
      mentionContext = `...${aiResponse.slice(start, end).trim()}...`;

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

    return { query, mentioned, position, mentionContext, aiResponse, provider: 'perplexity' };
  }
}
