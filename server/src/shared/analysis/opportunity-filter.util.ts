/**
 * Opportunity filter — threshold-based filtering for keyword lists.
 * Port of python-sidecar opportunity filter logic.
 */

export interface OpportunityFilterOptions {
  minVolume?: number;
  maxDifficulty?: number;
  minOpportunityScore?: number;
  minCpc?: number;
  includeQuickWinsOnly?: boolean;
}

export interface FilterableKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  opportunityScore: number;
  cpc?: number;
  isQuickWin?: boolean;
  [key: string]: unknown;
}

const DEFAULT_OPTIONS: Required<OpportunityFilterOptions> = {
  minVolume: 50,
  maxDifficulty: 80,
  minOpportunityScore: 30,
  minCpc: 0,
  includeQuickWinsOnly: false,
};

/**
 * Filter keywords by opportunity thresholds.
 * Returns only keywords meeting all specified criteria.
 */
export function filterByOpportunity<T extends FilterableKeyword>(
  keywords: T[],
  options: OpportunityFilterOptions = {},
): T[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return keywords.filter((kw) => {
    if (opts.includeQuickWinsOnly && !kw.isQuickWin) return false;
    if (kw.volume < opts.minVolume) return false;
    if (kw.difficulty > opts.maxDifficulty) return false;
    if (kw.opportunityScore < opts.minOpportunityScore) return false;
    if ((kw.cpc ?? 0) < opts.minCpc) return false;
    return true;
  });
}
