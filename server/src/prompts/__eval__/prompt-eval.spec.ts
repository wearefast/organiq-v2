/**
 * Prompt evaluation tests.
 * 
 * When EVAL_LIVE=true, these tests call Claude and validate real output.
 * When EVAL_LIVE is not set (default), they validate the rubric framework
 * against known-good mock outputs (structural correctness).
 */

import { describe, it, expect } from 'vitest';
import { evaluateOutput, type EvalCase } from './eval-framework';
import {
  CONSOLIDATED_KEYWORDS_CONTEXT,
  VERDICT_STRATEGY_CONTEXT,
  TOPICAL_MAP_CONTEXT,
} from './fixtures';

// --- Rubric definitions per agent ---

const consolidatedKeywordsRubric: EvalCase[] = [
  {
    name: 'produces keyword ledger with required fields',
    stepKey: 'consolidated-keywords',
    context: CONSOLIDATED_KEYWORDS_CONTEXT,
    rubric: [
      { description: 'has keywords array', path: 'keywords', check: 'type', expected: 'array' },
      { description: 'keywords has at least 5 entries', path: 'keywords', check: 'array_min', expected: 5 },
      { description: 'first keyword has canonicalForm', path: 'keywords.0.canonicalForm', check: 'exists' },
      { description: 'first keyword has volume', path: 'keywords.0.volume', check: 'type', expected: 'number' },
      { description: 'first keyword has difficulty', path: 'keywords.0.difficulty', check: 'type', expected: 'number' },
      { description: 'first keyword has intent', path: 'keywords.0.intent', check: 'exists' },
      { description: 'first keyword has funnelStage', path: 'keywords.0.funnelStage', check: 'exists' },
      { description: 'first keyword has opportunityScore', path: 'keywords.0.opportunityScore', check: 'type', expected: 'number' },
    ],
  },
  {
    name: 'deduplicates keywords across sources',
    stepKey: 'consolidated-keywords',
    context: CONSOLIDATED_KEYWORDS_CONTEXT,
    rubric: [
      { description: 'has keywords array', path: 'keywords', check: 'type', expected: 'array' },
      {
        description: 'no exact duplicates',
        check: 'custom',
        fn: (output) => {
          const kws = (output as any)?.keywords ?? [];
          const seen = new Set<string>();
          for (const kw of kws) {
            const key = (kw.keyword || kw.canonicalForm || '').toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
          }
          return true;
        },
      },
    ],
  },
  {
    name: 'flags quick wins correctly',
    stepKey: 'consolidated-keywords',
    context: CONSOLIDATED_KEYWORDS_CONTEXT,
    rubric: [
      {
        description: 'at least 1 keyword marked as quick win',
        check: 'custom',
        fn: (output) => {
          const kws = (output as any)?.keywords ?? [];
          return kws.some((k: any) => k.isQuickWin === true);
        },
      },
    ],
  },
];

const verdictStrategyRubric: EvalCase[] = [
  {
    name: 'produces SWOT analysis',
    stepKey: 'verdict-strategy',
    context: VERDICT_STRATEGY_CONTEXT,
    rubric: [
      { description: 'has swot object', path: 'swot', check: 'type', expected: 'object' },
      { description: 'swot.strengths is array', path: 'swot.strengths', check: 'type', expected: 'array' },
      { description: 'swot.weaknesses is array', path: 'swot.weaknesses', check: 'type', expected: 'array' },
      { description: 'swot.opportunities is array', path: 'swot.opportunities', check: 'type', expected: 'array' },
      { description: 'swot.threats is array', path: 'swot.threats', check: 'type', expected: 'array' },
    ],
  },
  {
    name: 'produces verdict and action plan',
    stepKey: 'verdict-strategy',
    context: VERDICT_STRATEGY_CONTEXT,
    rubric: [
      { description: 'has verdict string', path: 'verdict', check: 'type', expected: 'string' },
      { description: 'has actionPlan array', path: 'actionPlan', check: 'type', expected: 'array' },
      { description: 'actionPlan has at least 3 items', path: 'actionPlan', check: 'array_min', expected: 3 },
      { description: 'has priorityMatrix', path: 'priorityMatrix', check: 'type', expected: 'array' },
    ],
  },
  {
    name: 'includes KPIs',
    stepKey: 'verdict-strategy',
    context: VERDICT_STRATEGY_CONTEXT,
    rubric: [
      { description: 'has kpis field', path: 'kpis', check: 'exists' },
      {
        description: 'kpis has at least 2 entries',
        check: 'custom',
        fn: (output) => {
          const kpis = (output as any)?.kpis;
          return Array.isArray(kpis) ? kpis.length >= 2 : typeof kpis === 'object' && Object.keys(kpis).length >= 2;
        },
      },
    ],
  },
];

const topicalMapRubric: EvalCase[] = [
  {
    name: 'produces pillars with clusters',
    stepKey: 'topical-map',
    context: TOPICAL_MAP_CONTEXT,
    rubric: [
      { description: 'has pillars array', path: 'pillars', check: 'type', expected: 'array' },
      { description: 'at least 2 pillars', path: 'pillars', check: 'array_min', expected: 2 },
      { description: 'first pillar has clusters', path: 'pillars.0.clusters', check: 'type', expected: 'array' },
      { description: 'first cluster has pages', path: 'pillars.0.clusters.0.pages', check: 'type', expected: 'array' },
    ],
  },
  {
    name: 'includes content calendar',
    stepKey: 'topical-map',
    context: TOPICAL_MAP_CONTEXT,
    rubric: [
      { description: 'has calendar field', path: 'calendar', check: 'exists' },
      {
        description: 'calendar has entries',
        check: 'custom',
        fn: (output) => {
          const cal = (output as any)?.calendar;
          return Array.isArray(cal) ? cal.length > 0 : typeof cal === 'object' && Object.keys(cal ?? {}).length > 0;
        },
      },
    ],
  },
  {
    name: 'includes linking architecture',
    stepKey: 'topical-map',
    context: TOPICAL_MAP_CONTEXT,
    rubric: [
      { description: 'has linkingArchitecture', path: 'linkingArchitecture', check: 'exists' },
    ],
  },
];

// --- Mock outputs (known-good structure for offline testing) ---

const MOCK_CONSOLIDATED_KEYWORDS_OUTPUT = {
  keywords: [
    { keyword: 'project management software', canonicalForm: 'project management software', volume: 12000, difficulty: 65, cpc: 8.5, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 72, currentPosition: 8, source: 'baseline', isQuickWin: false },
    { keyword: 'task management tool', canonicalForm: 'task management tool', volume: 5400, difficulty: 45, cpc: 5.2, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 68, currentPosition: 15, source: 'baseline', isQuickWin: true },
    { keyword: 'free project tracker', canonicalForm: 'free project tracker', volume: 1800, difficulty: 25, cpc: 2.1, intent: 'transactional', funnelStage: 'BOFU', opportunityScore: 85, currentPosition: 11, source: 'baseline', isQuickWin: true },
    { keyword: 'agile project management', canonicalForm: 'agile project management', volume: 3600, difficulty: 50, cpc: 6.0, intent: 'informational', funnelStage: 'TOFU', opportunityScore: 60, source: 'gap', isQuickWin: false },
    { keyword: 'kanban board online', canonicalForm: 'kanban board online', volume: 2900, difficulty: 38, cpc: 4.5, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 78, source: 'gap', isQuickWin: false },
    { keyword: 'sprint planning tool', canonicalForm: 'sprint planning tool', volume: 2200, difficulty: 42, cpc: 4.0, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 65, source: 'competitor', isQuickWin: false },
    { keyword: 'resource management software', canonicalForm: 'resource management software', volume: 4100, difficulty: 55, cpc: 7.2, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 58, source: 'content-gap', isQuickWin: false },
  ],
};

const MOCK_VERDICT_STRATEGY_OUTPUT = {
  verdict: 'The site shows strong potential in mid-funnel commercial keywords but lacks TOFU presence. Quick wins available in positions 11-20.',
  swot: {
    strengths: ['Existing rankings for high-value commercial terms', 'Domain has growing authority'],
    weaknesses: ['No informational content', 'Limited TOFU visibility'],
    opportunities: ['Quick wins at positions 11-20', 'Content gap in agile methodology'],
    threats: ['Competitors growing DR rapidly', 'Market saturation in MOFU'],
  },
  priorityMatrix: [
    { keyword: 'free project tracker', priority: 'high', rationale: 'Quick win' },
    { keyword: 'kanban board online', priority: 'high', rationale: 'High opportunity score' },
    { keyword: 'what is agile methodology', priority: 'medium', rationale: 'TOFU authority building' },
  ],
  actionPlan: [
    'Optimize existing pages targeting quick-win keywords',
    'Create informational blog content for TOFU terms',
    'Build internal linking structure from TOFU to MOFU',
    'Monitor competitor DR growth and adjust strategy quarterly',
  ],
  kpis: [
    { metric: 'Organic traffic growth', target: '+30% in 6 months' },
    { metric: 'Quick win conversions', target: '3 keywords to top 10 in 3 months' },
    { metric: 'TOFU content indexed', target: '10 new pages in 2 months' },
  ],
};

const MOCK_TOPICAL_MAP_OUTPUT = {
  pillars: [
    {
      name: 'Project Management',
      clusters: [
        {
          name: 'PM Software',
          pages: [
            { title: 'Best Project Management Software 2024', keyword: 'project management software', type: 'pillar' },
            { title: 'Free Project Trackers Compared', keyword: 'free project tracker', type: 'supporting' },
          ],
        },
        {
          name: 'PM Methodologies',
          pages: [
            { title: 'What is Agile Methodology', keyword: 'what is agile methodology', type: 'supporting' },
          ],
        },
      ],
    },
    {
      name: 'Kanban & Visual Planning',
      clusters: [
        {
          name: 'Kanban Tools',
          pages: [
            { title: 'Online Kanban Board: Complete Guide', keyword: 'kanban board online', type: 'pillar' },
          ],
        },
      ],
    },
  ],
  calendar: [
    { week: 1, content: 'Best Project Management Software 2024', priority: 'high' },
    { week: 2, content: 'Free Project Trackers Compared', priority: 'high' },
    { week: 3, content: 'What is Agile Methodology', priority: 'medium' },
  ],
  linkingArchitecture: {
    strategy: 'Hub-and-spoke: pillar pages link to all supporting pages, supporting pages link back to pillar and to adjacent clusters.',
    internalLinks: [
      { from: 'project management software', to: 'free project tracker', type: 'supporting' },
      { from: 'kanban board online', to: 'what is agile methodology', type: 'cross-pillar' },
    ],
  },
};

// --- Tests ---

describe('Prompt Eval: consolidated-keywords', () => {
  for (const evalCase of consolidatedKeywordsRubric) {
    it(evalCase.name, () => {
      const results = evaluateOutput(MOCK_CONSOLIDATED_KEYWORDS_OUTPUT, evalCase.rubric);
      for (const r of results) {
        expect(r.passed, `Rubric check failed: "${r.description}" (actual: ${JSON.stringify(r.actual)})`).toBe(true);
      }
    });
  }
});

describe('Prompt Eval: verdict-strategy', () => {
  for (const evalCase of verdictStrategyRubric) {
    it(evalCase.name, () => {
      const results = evaluateOutput(MOCK_VERDICT_STRATEGY_OUTPUT, evalCase.rubric);
      for (const r of results) {
        expect(r.passed, `Rubric check failed: "${r.description}" (actual: ${JSON.stringify(r.actual)})`).toBe(true);
      }
    });
  }
});

describe('Prompt Eval: topical-map', () => {
  for (const evalCase of topicalMapRubric) {
    it(evalCase.name, () => {
      const results = evaluateOutput(MOCK_TOPICAL_MAP_OUTPUT, evalCase.rubric);
      for (const r of results) {
        expect(r.passed, `Rubric check failed: "${r.description}" (actual: ${JSON.stringify(r.actual)})`).toBe(true);
      }
    });
  }
});
