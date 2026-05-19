import { describe, it, expect } from 'vitest';
import { AgentRouterService } from './agent-router.service';

describe('AgentRouterService', () => {
  const router = new AgentRouterService();

  describe('classify', () => {
    it('routes content refresh prompts correctly', () => {
      expect(router.classify('Which pages need to be refreshed?')).toBe('content-refresh');
      expect(router.classify('What content is stale?')).toBe('content-refresh');
      expect(router.classify('Pages that need updating')).toBe('content-refresh');
    });

    it('routes AI search visibility prompts correctly', () => {
      expect(router.classify('How am I performing in AI search?')).toBe('ai-search-visibility');
      expect(router.classify('Show me my Perplexity visibility')).toBe('ai-search-visibility');
      expect(router.classify('Am I cited in ChatGPT?')).toBe('ai-search-visibility');
    });

    it('routes technical issues prompts correctly', () => {
      expect(router.classify('What are my most critical technical issues?')).toBe('technical-issues');
      expect(router.classify('Show me audit errors')).toBe('technical-issues');
    });

    it('routes keyword opportunity prompts correctly', () => {
      expect(router.classify('What content should I write next?')).toBe('keyword-opportunity');
      expect(router.classify('Show me content gaps')).toBe('keyword-opportunity');
    });

    it('routes Google vs AI prompts correctly', () => {
      expect(router.classify('How does my Google traffic compare to AI search?')).toBe('google-vs-ai');
      expect(router.classify('Google vs AI channel comparison')).toBe('google-vs-ai');
    });

    it('routes keyword decay prompts correctly', () => {
      expect(router.classify('Which keywords are declining?')).toBe('keyword-decay');
      expect(router.classify('Am I losing rankings?')).toBe('keyword-decay');
    });

    it('routes competitor prompts correctly', () => {
      expect(router.classify('How do I compare to competitors?')).toBe('competitor-analysis');
      expect(router.classify('Show me competitor benchmark data')).toBe('competitor-analysis');
    });

    it('respects explicit agent type', () => {
      expect(router.classify('random prompt', 'technical-issues')).toBe('technical-issues');
      expect(router.classify('random prompt', 'keyword-decay')).toBe('keyword-decay');
    });

    it('falls back to content-refresh for unknown prompts', () => {
      expect(router.classify('hello world')).toBe('content-refresh');
    });
  });

  describe('getAllTypes', () => {
    it('returns all 7 agent types', () => {
      const types = router.getAllTypes();
      expect(types).toHaveLength(7);
      expect(types.map((t) => t.type)).toContain('content-refresh');
      expect(types.map((t) => t.type)).toContain('ai-search-visibility');
      expect(types.map((t) => t.type)).toContain('technical-issues');
      expect(types.map((t) => t.type)).toContain('keyword-opportunity');
      expect(types.map((t) => t.type)).toContain('google-vs-ai');
      expect(types.map((t) => t.type)).toContain('keyword-decay');
      expect(types.map((t) => t.type)).toContain('competitor-analysis');
    });

    it('every type has a label and credit cost', () => {
      const types = router.getAllTypes();
      for (const t of types) {
        expect(t.label).toBeTruthy();
        expect(t.creditCost).toBeGreaterThan(0);
      }
    });
  });
});
