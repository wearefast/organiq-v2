/**
 * Competitor gaps — set difference to find keywords competitors rank for but target doesn't.
 * Port of python-sidecar competitor-gaps logic.
 */

export interface GapKeyword {
  keyword: string;
  sourceDomains: string[];
  avgPosition?: number;
  volume?: number;
}

/**
 * Find content gap keywords: keywords competitors have that the target domain doesn't.
 */
export function findCompetitorGaps(
  targetKeywords: string[],
  competitorKeywords: Array<{ keyword: string; domain: string; position?: number; volume?: number }>,
): GapKeyword[] {
  const targetSet = new Set(targetKeywords.map((kw) => kw.toLowerCase().trim()));

  // Group competitor keywords by keyword
  const gapMap = new Map<string, { domains: Set<string>; positions: number[]; volume: number }>();

  for (const item of competitorKeywords) {
    const kw = item.keyword.toLowerCase().trim();
    if (!kw || targetSet.has(kw)) continue;

    if (!gapMap.has(kw)) {
      gapMap.set(kw, { domains: new Set(), positions: [], volume: item.volume ?? 0 });
    }

    const entry = gapMap.get(kw)!;
    entry.domains.add(item.domain);
    if (item.position) entry.positions.push(item.position);
    if (item.volume && item.volume > entry.volume) entry.volume = item.volume;
  }

  // Convert to array, sorted by number of competitor domains (more = higher opportunity)
  const gaps: GapKeyword[] = [];
  for (const [keyword, data] of gapMap) {
    gaps.push({
      keyword,
      sourceDomains: [...data.domains],
      avgPosition: data.positions.length > 0 ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length : undefined,
      volume: data.volume || undefined,
    });
  }

  gaps.sort((a, b) => b.sourceDomains.length - a.sourceDomains.length);

  return gaps;
}
