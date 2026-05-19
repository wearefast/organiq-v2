/**
 * Synthetic test fixtures for prompt evaluation.
 * Deterministic, version-controlled, designed to cover edge cases.
 */

export const CONSOLIDATED_KEYWORDS_CONTEXT = {
  domain: 'example-saas.com',
  country: 'us',
  'phase1-baseline': {
    currentRankings: [
      { keyword: 'project management software', position: 8, volume: 12000, difficulty: 65 },
      { keyword: 'task management tool', position: 15, volume: 5400, difficulty: 45 },
      { keyword: 'team collaboration app', position: 22, volume: 8100, difficulty: 55 },
    ],
    gaps: [
      { keyword: 'agile project management', volume: 3600, difficulty: 50 },
      { keyword: 'kanban board online', volume: 2900, difficulty: 38 },
    ],
    quickWins: [
      { keyword: 'free project tracker', position: 11, volume: 1800, difficulty: 25 },
    ],
  },
  'method01-competitor-pages': {
    keywords: [
      { keyword: 'project planning software', sourceDomain: 'competitor1.com', volume: 4500 },
      { keyword: 'sprint planning tool', sourceDomain: 'competitor1.com', volume: 2200 },
      { keyword: 'project management software', sourceDomain: 'competitor2.com', volume: 12000 },
    ],
  },
  'method02-seed-expansion': {
    expanded: [
      { keyword: 'best project management software 2024', source: 'related', volume: 6600 },
      { keyword: 'project management for small teams', source: 'suggestions', volume: 3200 },
      { keyword: 'free kanban board', source: 'related', volume: 2100 },
    ],
  },
  'method03-content-gap-import': {
    gaps: [
      { keyword: 'resource management software', sourceDomains: ['comp1.com', 'comp2.com'], volume: 4100 },
      { keyword: 'project timeline maker', sourceDomains: ['comp1.com'], volume: 2800 },
    ],
  },
};

export const VERDICT_STRATEGY_CONTEXT = {
  domain: 'example-saas.com',
  country: 'us',
  'consolidated-keywords': {
    keywords: [
      { keyword: 'project management software', volume: 12000, difficulty: 65, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 72, currentPosition: 8 },
      { keyword: 'free project tracker', volume: 1800, difficulty: 25, intent: 'transactional', funnelStage: 'BOFU', opportunityScore: 85, currentPosition: 11, isQuickWin: true },
      { keyword: 'what is agile methodology', volume: 8200, difficulty: 35, intent: 'informational', funnelStage: 'TOFU', opportunityScore: 60 },
      { keyword: 'kanban board online', volume: 2900, difficulty: 38, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 78 },
      { keyword: 'project planning software', volume: 4500, difficulty: 50, intent: 'commercial', funnelStage: 'MOFU', opportunityScore: 65 },
    ],
    meta: { totalKeywords: 5, quickWins: 1 },
  },
  'competitor-metrics': {
    targetDomain: { domain: 'example-saas.com', domainRating: 45 },
    competitors: [
      { domain: 'competitor1.com', domainRating: 72, status: 'success' },
      { domain: 'competitor2.com', domainRating: 58, status: 'success' },
    ],
  },
};

export const TOPICAL_MAP_CONTEXT = {
  domain: 'example-saas.com',
  country: 'us',
  'verdict-strategy': {
    verdict: 'The site has strong MOFU content but lacks TOFU informational pages to capture top-of-funnel traffic.',
    swot: {
      strengths: ['Strong domain authority for mid-funnel keywords', 'Existing rankings in positions 4-20'],
      weaknesses: ['No informational content strategy', 'Low TOFU visibility'],
      opportunities: ['Quick wins in positions 11-20 with low difficulty', 'Content gap in agile/kanban topics'],
      threats: ['Competitors growing fast in informational space'],
    },
    priorityMatrix: [
      { keyword: 'free project tracker', priority: 'high', rationale: 'Quick win, position 11, difficulty 25' },
      { keyword: 'kanban board online', priority: 'high', rationale: 'Opportunity score 78, moderate difficulty' },
      { keyword: 'what is agile methodology', priority: 'medium', rationale: 'High volume TOFU, builds authority' },
    ],
    actionPlan: [
      'Optimize existing pages for quick-win keywords',
      'Create TOFU blog content around agile/kanban topics',
      'Build internal linking from TOFU → MOFU → BOFU',
    ],
  },
  'consolidated-keywords': {
    keywords: [
      { keyword: 'project management software', volume: 12000, difficulty: 65, intent: 'commercial', funnelStage: 'MOFU' },
      { keyword: 'free project tracker', volume: 1800, difficulty: 25, intent: 'transactional', funnelStage: 'BOFU' },
      { keyword: 'what is agile methodology', volume: 8200, difficulty: 35, intent: 'informational', funnelStage: 'TOFU' },
      { keyword: 'kanban board online', volume: 2900, difficulty: 38, intent: 'commercial', funnelStage: 'MOFU' },
    ],
  },
};
