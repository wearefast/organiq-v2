/**
 * Mock providers for external services.
 * Return deterministic data for unit testing without real API calls.
 */
import { vi } from 'vitest';

// ─── Mock OpenAI Service ─────────────────────────────────────

export function createMockOpenAiService() {
  return {
    chatCompletion: vi.fn().mockResolvedValue({
      message: {
        role: 'assistant' as const,
        content: '{"result": "mock response"}',
        tool_calls: undefined,
      },
      finishReason: 'stop' as const,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }),
  };
}

// ─── Mock Ahrefs Service ─────────────────────────────────────

export function createMockAhrefsService() {
  return {
    getDomainRating: vi.fn().mockResolvedValue({
      domain_rating: 45,
      ahrefs_rank: 12000,
    }),
    getOrganicKeywords: vi.fn().mockResolvedValue({
      keywords: [
        {
          keyword: 'test keyword',
          volume: 1200,
          keyword_difficulty: 35,
          best_position: 5,
          best_position_url: 'https://example.com/page',
          sum_traffic: 80,
          cpc: 1.5,
        },
      ],
    }),
    getOrganicPages: vi.fn().mockResolvedValue({
      pages: [
        {
          url: 'https://example.com/page',
          sum_traffic: 200,
          top_keyword: 'test keyword',
          top_keyword_best_position: 3,
          top_keyword_volume: 1200,
          keywords: 15,
        },
      ],
    }),
  };
}

// ─── Mock DataForSEO Service ─────────────────────────────────

export function createMockDataForSeoService() {
  return {
    getSerpResults: vi.fn().mockResolvedValue({
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: 'organic',
                  rank_group: 1,
                  url: 'https://example.com/page',
                  title: 'Test Page',
                  description: 'A test page description',
                },
              ],
            },
          ],
        },
      ],
    }),
    getKeywordSearchVolume: vi.fn().mockResolvedValue({
      tasks: [
        {
          result: [
            {
              keyword: 'test keyword',
              search_volume: 1200,
              competition: 0.45,
              cpc: 1.5,
            },
          ],
        },
      ],
    }),
    getKeywordSuggestions: vi.fn().mockResolvedValue({
      tasks: [
        {
          result: [
            {
              items: [
                { keyword: 'related keyword 1', search_volume: 800 },
                { keyword: 'related keyword 2', search_volume: 600 },
              ],
            },
          ],
        },
      ],
    }),
    getKeywordDifficulty: vi.fn().mockResolvedValue({
      tasks: [
        {
          result: [
            {
              keyword: 'test keyword',
              search_volume: 1200,
              competition: 0.45,
            },
          ],
        },
      ],
    }),
  };
}

// ─── Mock Database Service ───────────────────────────────────

export function createMockDatabaseService() {
  return {
    db: {
      execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      query: {},
    },
  };
}
