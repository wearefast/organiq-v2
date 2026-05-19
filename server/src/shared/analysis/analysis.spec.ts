import { describe, it, expect } from 'vitest';
import { analyzeCitability } from './citability.util';
import { parsePageSpeed } from './pagespeed-parser.util';
import { scoreKeyword, scoreKeywords } from './keyword-scoring.util';
import { filterByOpportunity } from './opportunity-filter.util';
import { findCompetitorGaps } from './competitor-gaps.util';
import { analyzeBrandMentions } from './brand-mentions.util';

describe('analyzeCitability', () => {
  it('returns low score for empty HTML', () => {
    const result = analyzeCitability('<html><body></body></html>');
    // Empty HTML still gets short_paragraphs (avgLen 0 < 150) = 10 points
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('detects schema markup', () => {
    const html = '<html><head><script type="application/ld+json">{"@type":"FAQPage"}</script></head><body></body></html>';
    const result = analyzeCitability(html);
    expect(result.signals.has_schema).toBe(true);
    expect(result.signals.has_faq).toBe(true);
  });

  it('detects tables and lists', () => {
    const html = `<html><body>
      <table><tr><td>1</td></tr></table>
      <ul><li>a</li></ul><ul><li>b</li></ul><ul><li>c</li></ul>
      <h1>Title</h1><h2>Sub</h2><h3>Sub2</h3>
    </body></html>`;
    const result = analyzeCitability(html);
    expect(result.signals.has_tables).toBe(true);
    expect(result.signals.has_lists).toBe(true);
    expect(result.signals.has_headings).toBe(true);
  });

  it('produces score between 0 and 100', () => {
    const fullHtml = `<html><head><script type="application/ld+json">{"@type":"FAQPage"}</script></head><body>
      <table><tr><td>x</td></tr></table>
      <ul><li>a</li></ul><ul><li>b</li></ul><ul><li>c</li></ul>
      <h1>T</h1><h2>S</h2><h3>S2</h3>
      <dl><dt>Term</dt><dd>Def</dd></dl>
      <span class="author">Author</span>
      <p>Short paragraph.</p>
      <p>Revenue grew 45% year-over-year.</p>
    </body></html>`;
    const result = analyzeCitability(fullHtml);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('parsePageSpeed', () => {
  it('parses empty Lighthouse data', () => {
    const result = parsePageSpeed({});
    expect(result.performanceScore).toBe(0);
    expect(result.metrics).toBeDefined();
    expect(result.opportunities).toEqual([]);
  });

  it('extracts performance score', () => {
    const result = parsePageSpeed({
      lighthouseResult: {
        categories: { performance: { score: 0.85 } },
        audits: {
          'largest-contentful-paint': { displayValue: '2.1 s' },
          'cumulative-layout-shift': { displayValue: '0.05' },
        },
      },
    });
    expect(result.performanceScore).toBe(85);
    expect(result.metrics.lcp).toBe('2.1 s');
    expect(result.metrics.cls).toBe('0.05');
  });

  it('extracts opportunities above 100ms', () => {
    const result = parsePageSpeed({
      lighthouseResult: {
        categories: { performance: { score: 0.5 } },
        audits: {
          'render-blocking-resources': {
            title: 'Eliminate render-blocking resources',
            description: 'Desc',
            details: { type: 'opportunity', overallSavingsMs: 500 },
          },
          'unused-css': {
            title: 'Remove unused CSS',
            description: 'Desc',
            details: { type: 'opportunity', overallSavingsMs: 50 }, // Below threshold
          },
        },
      },
    });
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].savingsMs).toBe(500);
  });
});

describe('scoreKeyword', () => {
  it('scores a high-opportunity keyword', () => {
    const result = scoreKeyword({ volume: 5400, difficulty: 30, cpc: 3.5, currentPosition: 8 });
    expect(result.opportunityScore).toBeGreaterThan(50);
    expect(result.isQuickWin).toBe(true);
  });

  it('scores a low-opportunity keyword', () => {
    const result = scoreKeyword({ volume: 10, difficulty: 95, cpc: 0, currentPosition: 100 });
    expect(result.opportunityScore).toBeLessThan(30);
    expect(result.isQuickWin).toBe(false);
  });

  it('identifies quick wins', () => {
    const result = scoreKeyword({ volume: 500, difficulty: 25, currentPosition: 12 });
    expect(result.isQuickWin).toBe(true);
  });

  it('does not flag position 3 as quick win', () => {
    const result = scoreKeyword({ volume: 1000, difficulty: 20, currentPosition: 3 });
    expect(result.isQuickWin).toBe(false);
  });

  it('handles null currentPosition', () => {
    const result = scoreKeyword({ volume: 1000, difficulty: 50, currentPosition: null });
    expect(result.isQuickWin).toBe(false);
    expect(result.opportunityScore).toBeGreaterThan(0);
  });
});

describe('scoreKeywords (batch)', () => {
  it('scores multiple keywords', () => {
    const results = scoreKeywords([
      { volume: 5000, difficulty: 40 },
      { volume: 100, difficulty: 80 },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].opportunityScore).toBeGreaterThan(results[1].opportunityScore);
  });
});

describe('filterByOpportunity', () => {
  const keywords = [
    { keyword: 'good', volume: 1000, difficulty: 30, opportunityScore: 75, cpc: 2, isQuickWin: true },
    { keyword: 'low-vol', volume: 10, difficulty: 20, opportunityScore: 40, cpc: 1, isQuickWin: false },
    { keyword: 'hard', volume: 5000, difficulty: 95, opportunityScore: 20, cpc: 5, isQuickWin: false },
  ];

  it('filters by default thresholds', () => {
    const result = filterByOpportunity(keywords);
    expect(result).toHaveLength(1);
    expect(result[0].keyword).toBe('good');
  });

  it('filters by custom minVolume', () => {
    const result = filterByOpportunity(keywords, { minVolume: 5, maxDifficulty: 100, minOpportunityScore: 0 });
    expect(result).toHaveLength(3);
  });

  it('filters quick wins only', () => {
    const result = filterByOpportunity(keywords, { includeQuickWinsOnly: true, minOpportunityScore: 0, minVolume: 0, maxDifficulty: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].keyword).toBe('good');
  });
});

describe('findCompetitorGaps', () => {
  it('finds keywords competitors have that target does not', () => {
    const gaps = findCompetitorGaps(
      ['seo', 'marketing'],
      [
        { keyword: 'seo', domain: 'comp.com', position: 3 },
        { keyword: 'link building', domain: 'comp.com', position: 5, volume: 2000 },
        { keyword: 'content strategy', domain: 'comp2.com', position: 8 },
      ],
    );
    expect(gaps).toHaveLength(2);
    expect(gaps.map((g) => g.keyword)).toContain('link building');
    expect(gaps.map((g) => g.keyword)).toContain('content strategy');
  });

  it('aggregates source domains', () => {
    const gaps = findCompetitorGaps(
      ['seo'],
      [
        { keyword: 'link building', domain: 'comp1.com' },
        { keyword: 'link building', domain: 'comp2.com' },
      ],
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0].sourceDomains).toContain('comp1.com');
    expect(gaps[0].sourceDomains).toContain('comp2.com');
  });

  it('sorts by number of source domains (desc)', () => {
    const gaps = findCompetitorGaps(
      ['seo'],
      [
        { keyword: 'rare', domain: 'comp1.com' },
        { keyword: 'common', domain: 'comp1.com' },
        { keyword: 'common', domain: 'comp2.com' },
        { keyword: 'common', domain: 'comp3.com' },
      ],
    );
    expect(gaps[0].keyword).toBe('common');
    expect(gaps[0].sourceDomains.length).toBe(3);
  });

  it('returns empty array when no gaps', () => {
    const gaps = findCompetitorGaps(
      ['seo', 'marketing'],
      [{ keyword: 'seo', domain: 'comp.com' }],
    );
    expect(gaps).toHaveLength(0);
  });
});

describe('analyzeBrandMentions', () => {
  it('counts mentions across texts', () => {
    const result = analyzeBrandMentions('Acme', [
      'Acme is a great company. I love Acme.',
      'No mentions here.',
      'Acme launched a new product.',
    ]);
    expect(result.totalMentions).toBe(3);
    expect(result.sentimentBreakdown.neutral).toBe(3);
  });

  it('returns contexts with surrounding text', () => {
    const result = analyzeBrandMentions('Acme', ['The company Acme released a new tool today']);
    expect(result.contexts).toHaveLength(1);
    expect(result.contexts[0].context).toContain('Acme');
  });

  it('handles special regex characters in brand name', () => {
    const result = analyzeBrandMentions('C++', ['C++ is a programming language. I love C++.']);
    expect(result.totalMentions).toBe(2);
  });

  it('is case-insensitive', () => {
    const result = analyzeBrandMentions('Acme', ['acme and ACME are the same']);
    expect(result.totalMentions).toBe(2);
  });

  it('limits contexts to 20 total', () => {
    const texts = Array.from({ length: 30 }, () => 'Acme Acme Acme');
    const result = analyzeBrandMentions('Acme', texts);
    expect(result.contexts.length).toBeLessThanOrEqual(20);
  });
});
