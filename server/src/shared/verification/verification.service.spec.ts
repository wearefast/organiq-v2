import { describe, it, expect } from 'vitest';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  const service = new VerificationService();

  describe('verify()', () => {
    it('returns valid:true for steps with no rules', () => {
      const result = service.verify('some-unknown-step', { data: 'anything' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid:true for valid consolidated-keywords output', () => {
      const output = {
        keywords: [
          {
            keyword: 'seo tools',
            canonicalForm: 'seo tools',
            volume: 5400,
            difficulty: 45,
            cpc: 2.5,
            intent: 'commercial',
            funnelStage: 'MOFU',
            opportunityScore: 78,
            currentPosition: 12,
            source: 'baseline',
            parentTopic: null,
            isQuickWin: true,
            serpFeatures: ['featured_snippet'],
          },
          {
            keyword: 'keyword research',
            canonicalForm: 'keyword research',
            volume: 12000,
            difficulty: 60,
            cpc: 3.2,
            intent: 'informational',
            funnelStage: 'TOFU',
            opportunityScore: 65,
            currentPosition: null,
            source: 'method01',
            parentTopic: 'seo',
            isQuickWin: false,
            serpFeatures: [],
          },
        ],
        stats: { totalKeywords: 10, afterDedup: 2, bySource: {}, byIntent: {}, byFunnel: {} },
        clusters: [],
        quickWins: [],
      };

      const result = service.verify('consolidated-keywords', output);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors when keywords array has duplicates', () => {
      const output = {
        keywords: [
          { keyword: 'seo tools', volume: 100, difficulty: 10, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 50, source: 'baseline' },
          { keyword: 'SEO Tools', volume: 200, difficulty: 20, intent: 'informational', funnelStage: 'TOFU', opportunityScore: 60, source: 'method01' },
        ],
        stats: { afterDedup: 2 },
      };

      const result = service.verify('consolidated-keywords', output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
    });

    it('returns errors when stats.afterDedup mismatches actual count', () => {
      const output = {
        keywords: [
          { keyword: 'seo tools', volume: 100, difficulty: 10, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 50, source: 'baseline' },
        ],
        stats: { afterDedup: 5 },
      };

      const result = service.verify('consolidated-keywords', output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('afterDedup'))).toBe(true);
    });

    it('returns errors when required fields are missing', () => {
      const output = {
        keywords: [
          { keyword: 'seo tools' }, // missing volume, difficulty, intent, funnelStage, opportunityScore, source
        ],
        stats: { afterDedup: 1 },
      };

      const result = service.verify('consolidated-keywords', output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('volume'))).toBe(true);
      expect(result.errors.some((e) => e.includes('difficulty'))).toBe(true);
      expect(result.errors.some((e) => e.includes('intent'))).toBe(true);
    });

    it('returns errors for invalid intent values', () => {
      const output = {
        keywords: [
          { keyword: 'test', volume: 100, difficulty: 10, intent: 'invalid_intent', funnelStage: 'TOFU', opportunityScore: 50, source: 'baseline' },
        ],
        stats: { afterDedup: 1 },
      };

      const result = service.verify('consolidated-keywords', output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid intent'))).toBe(true);
    });

    it('returns errors for invalid funnelStage values', () => {
      const output = {
        keywords: [
          { keyword: 'test', volume: 100, difficulty: 10, intent: 'commercial', funnelStage: 'INVALID', opportunityScore: 50, source: 'baseline' },
        ],
        stats: { afterDedup: 1 },
      };

      const result = service.verify('consolidated-keywords', output);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('funnelStage'))).toBe(true);
    });

    it('returns error when output is not an object', () => {
      const result = service.verify('consolidated-keywords', 'not an object');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe('Output is not a valid object');
    });

    it('returns error when keywords is not an array', () => {
      const result = service.verify('consolidated-keywords', { keywords: 'not array' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Missing or invalid "keywords" array');
    });
  });

  describe('getRulesForStep()', () => {
    it('returns rule names for consolidated-keywords step', () => {
      const rules = service.getRulesForStep('consolidated-keywords');
      expect(rules).toContain('consolidated-keywords-integrity');
    });

    it('returns empty array for unknown step', () => {
      const rules = service.getRulesForStep('unknown-step');
      expect(rules).toHaveLength(0);
    });
  });
});
