/**
 * API pricing constants for cost tracking.
 * All LLM prices are in USD per million tokens.
 * All per-call prices are in USD per request.
 *
 * Update this file when provider pricing changes and redeploy.
 */

// ─── LLM Pricing (per million tokens) ───────────────────────

export const ANTHROPIC_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  'claude-opus-4-6':              { inputPerMTok: 15.00, outputPerMTok: 75.00 },
  'claude-sonnet-4-6':            { inputPerMTok: 3.00,  outputPerMTok: 15.00 },
  'claude-3-5-sonnet-20241022':   { inputPerMTok: 3.00,  outputPerMTok: 15.00 },
  'claude-3-5-haiku-20241022':    { inputPerMTok: 0.80,  outputPerMTok: 4.00  },
  'claude-opus-4':                { inputPerMTok: 15.00, outputPerMTok: 75.00 },
  'claude-sonnet-4':              { inputPerMTok: 3.00,  outputPerMTok: 15.00 },
};
export const ANTHROPIC_DEFAULT_PRICING = { inputPerMTok: 3.00, outputPerMTok: 15.00 };

export const OPENAI_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  'gpt-4o':          { inputPerMTok: 2.50,  outputPerMTok: 10.00 },
  'gpt-4o-mini':     { inputPerMTok: 0.15,  outputPerMTok: 0.60  },
  'gpt-4-turbo':     { inputPerMTok: 10.00, outputPerMTok: 30.00 },
  'gpt-4':           { inputPerMTok: 30.00, outputPerMTok: 60.00 },
  'gpt-3.5-turbo':   { inputPerMTok: 0.50,  outputPerMTok: 1.50  },
};
export const OPENAI_DEFAULT_PRICING = { inputPerMTok: 2.50, outputPerMTok: 10.00 };

export const PERPLEXITY_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  'sonar':           { inputPerMTok: 1.00,  outputPerMTok: 1.00  },
  'sonar-pro':       { inputPerMTok: 3.00,  outputPerMTok: 15.00 },
  'sonar-deep-research': { inputPerMTok: 2.00, outputPerMTok: 8.00 },
  'r1-1776':         { inputPerMTok: 2.00,  outputPerMTok: 8.00  },
};
export const PERPLEXITY_DEFAULT_PRICING = { inputPerMTok: 1.00, outputPerMTok: 1.00 };

// ─── Per-Call API Pricing (USD per request) ──────────────────

export const AHREFS_PRICING: Record<string, number> = {
  '/site-explorer/domain-rating':         0.01,
  '/site-explorer/organic-keywords':      0.03,
  '/site-explorer/top-pages':             0.03,
  '/site-explorer/backlinks-stats':       0.01,
  '/site-explorer/organic-competitors':   0.03,
  '/site-explorer/brand-radar':           0.02,
  '/keywords-explorer/overview':          0.02,
  '/keywords-explorer/related-terms':     0.02,
  '/keywords-explorer/matching-terms':    0.02,
  '/serp-overview/serp-overview':         0.02,
};
export const AHREFS_DEFAULT_PRICE = 0.02;

export const SERPER_PRICING: Record<string, number> = {
  '/search':  0.001,
  '/news':    0.001,
  '/images':  0.001,
  '/places':  0.001,
};
export const SERPER_DEFAULT_PRICE = 0.001;

export const DATAFORSEO_PRICING: Record<string, number> = {
  '/serp/google/organic/live/advanced':                              0.0016,
  '/keywords_data/google_ads/search_volume/live':                   0.0015,
  '/keywords_data/google_ads/keywords_for_keywords/live':           0.0015,
  '/dataforseo_labs/google/ranked_keywords/live':                   0.0020,
  '/dataforseo_labs/google/bulk_keyword_difficulty/live':           0.0020,
  '/dataforseo_labs/google/competitors_domain/live':                0.0020,
  '/backlinks/summary/live':                                        0.0030,
  '/on_page/task_post':                                             0.0030,
  '/on_page/summary':                                               0.0005,
  '/on_page/pages':                                                 0.0010,
  '/domain_analytics/technologies/domain_technologies/live':        0.0015,
};
export const DATAFORSEO_DEFAULT_PRICE = 0.0020;

export const FIRECRAWL_PRICING: Record<string, number> = {
  '/scrape':  0.001,
  '/crawl':   0.001,
  '/map':     0.001,
};
export const FIRECRAWL_DEFAULT_PRICE = 0.001;

export const PAGESPEED_PRICING: Record<string, number> = {
  '/pagespeedonline':        0.0,   // Free tier
  '/records:queryRecord':    0.0,   // CrUX — free
};
export const PAGESPEED_DEFAULT_PRICE = 0.0;

// ─── Helpers ─────────────────────────────────────────────────

/** Compute USD cost for an LLM call using token counts and a pricing table. */
export function computeLlmCost(
  pricing: { inputPerMTok: number; outputPerMTok: number },
  tokensIn: number,
  tokensOut: number,
): number {
  return (tokensIn * pricing.inputPerMTok + tokensOut * pricing.outputPerMTok) / 1_000_000;
}

/** Look up Anthropic model price, falling back to default. */
export function anthropicCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = ANTHROPIC_PRICING[model] ?? ANTHROPIC_DEFAULT_PRICING;
  return computeLlmCost(pricing, tokensIn, tokensOut);
}

/** Look up OpenAI model price, falling back to default. */
export function openAiCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = OPENAI_PRICING[model] ?? OPENAI_DEFAULT_PRICING;
  return computeLlmCost(pricing, tokensIn, tokensOut);
}

/** Look up Perplexity model price, falling back to default. */
export function perplexityCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = PERPLEXITY_PRICING[model] ?? PERPLEXITY_DEFAULT_PRICING;
  return computeLlmCost(pricing, tokensIn, tokensOut);
}

/** Look up Ahrefs endpoint price. */
export function ahrefsCostUsd(endpoint: string): number {
  return AHREFS_PRICING[endpoint] ?? AHREFS_DEFAULT_PRICE;
}

/** Look up Serper endpoint price. */
export function serperCostUsd(endpoint: string): number {
  return SERPER_PRICING[endpoint] ?? SERPER_DEFAULT_PRICE;
}

/** Look up DataForSEO endpoint price. */
export function dataforseoEndpointCostUsd(endpoint: string): number {
  // Match on prefix since DataForSEO paths can have dynamic segments
  const match = Object.keys(DATAFORSEO_PRICING).find((key) => endpoint.startsWith(key));
  return match ? DATAFORSEO_PRICING[match] : DATAFORSEO_DEFAULT_PRICE;
}

/** Look up Firecrawl endpoint price. */
export function firecrawlCostUsd(endpoint: string): number {
  return FIRECRAWL_PRICING[endpoint] ?? FIRECRAWL_DEFAULT_PRICE;
}

/** Look up PageSpeed endpoint price (usually free). */
export function pagespeedCostUsd(_endpoint: string): number {
  return PAGESPEED_DEFAULT_PRICE;
}
