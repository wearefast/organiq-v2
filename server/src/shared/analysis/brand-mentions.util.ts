/**
 * Brand mentions detection — regex-based mention counting.
 * Port of python-sidecar/routers/analyze.py::analyze_brand_mentions
 */

export interface BrandMentionsResult {
  totalMentions: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  contexts: Array<{
    source: string;
    context: string;
    sentiment: string;
  }>;
}

/**
 * Detect brand mentions in a text corpus.
 */
export function analyzeBrandMentions(
  brandName: string,
  texts: string[],
  sources?: string[],
): BrandMentionsResult {
  const pattern = new RegExp(escapeRegex(brandName), 'gi');

  let totalMentions = 0;
  const contexts: BrandMentionsResult['contexts'] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const matches = [...text.matchAll(pattern)];
    totalMentions += matches.length;

    // Max 3 contexts per text
    for (const match of matches.slice(0, 3)) {
      const start = Math.max(0, match.index! - 100);
      const end = Math.min(text.length, match.index! + match[0].length + 100);
      const contextText = text.slice(start, end).trim();

      const source = sources && i < sources.length ? sources[i] : `text_${i}`;
      contexts.push({
        source,
        context: `...${contextText}...`,
        sentiment: 'neutral', // Basic — would use NLP model in production
      });
    }
  }

  return {
    totalMentions,
    sentimentBreakdown: { positive: 0, neutral: totalMentions, negative: 0 },
    contexts: contexts.slice(0, 20),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
