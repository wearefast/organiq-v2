/**
 * Keyword opportunity scoring formula.
 * Port of python-sidecar keyword scoring logic.
 */

export interface KeywordScoreInput {
  volume: number;
  difficulty: number;
  cpc?: number;
  currentPosition?: number | null;
}

export interface KeywordScoreResult {
  opportunityScore: number; // 0-100
  isQuickWin: boolean;
}

/**
 * Calculate opportunity score for a keyword.
 * Formula: weighted combination of volume potential, difficulty gap, and position opportunity.
 */
export function scoreKeyword(input: KeywordScoreInput): KeywordScoreResult {
  const { volume, difficulty, cpc = 0, currentPosition } = input;

  // Volume score (log scale, capped at 100)
  const volumeScore = Math.min(100, Math.log10(Math.max(volume, 1)) * 25);

  // Difficulty gap score (lower difficulty = higher opportunity)
  const difficultyScore = Math.max(0, 100 - difficulty);

  // Position opportunity (positions 4-20 have highest upside)
  let positionScore = 30; // Default for unranked
  if (currentPosition != null && currentPosition > 0) {
    if (currentPosition <= 3) positionScore = 10; // Already ranking well
    else if (currentPosition <= 10) positionScore = 70; // Page 1 improvement opportunity
    else if (currentPosition <= 20) positionScore = 90; // Close to page 1
    else if (currentPosition <= 50) positionScore = 50; // Some potential
    else positionScore = 20; // Deep ranking
  }

  // CPC bonus (higher CPC = commercial value)
  const cpcBonus = Math.min(10, cpc * 2);

  // Weighted formula
  const opportunityScore = Math.round(
    volumeScore * 0.3 + difficultyScore * 0.35 + positionScore * 0.25 + cpcBonus * 0.1,
  );

  // Quick win: position 4-20, difficulty < 40, volume > 100
  const isQuickWin =
    currentPosition != null &&
    currentPosition >= 4 &&
    currentPosition <= 20 &&
    difficulty < 40 &&
    volume > 100;

  return {
    opportunityScore: Math.min(100, Math.max(0, opportunityScore)),
    isQuickWin,
  };
}

/**
 * Batch score keywords.
 */
export function scoreKeywords(keywords: KeywordScoreInput[]): KeywordScoreResult[] {
  return keywords.map(scoreKeyword);
}
