import { Injectable } from '@nestjs/common';

// ─── Types ───────────────────────────────────────────────────

export interface VisibilityParseResult {
  brandMentioned: boolean;
  mentionPosition: number | null;
  responseExcerpt: string | null;
  competitorMentions: Array<{ brand: string; position: number; domain?: string }>;
  sentiment: 'positive' | 'neutral' | 'negative';
}

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class VisibilityParserService {
  /**
   * Parse an AI engine response to detect brand mentions, position, and competitors.
   */
  parse(
    responseText: string,
    brandName: string,
    brandDomain: string,
    competitors: string[] = [],
  ): VisibilityParseResult {
    if (!responseText || responseText.length === 0) {
      return {
        brandMentioned: false,
        mentionPosition: null,
        responseExcerpt: null,
        competitorMentions: [],
        sentiment: 'neutral',
      };
    }

    const lowerText = responseText.toLowerCase();
    const lowerBrand = brandName.toLowerCase();
    const lowerDomain = brandDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');

    // Detect brand mention
    const brandMentioned = lowerText.includes(lowerBrand) || lowerText.includes(lowerDomain);

    // Find position among all entities (brands) mentioned
    const allBrands = [brandName, ...competitors];
    const mentionPositions = this.findMentionPositions(responseText, allBrands, brandDomain);
    const brandPosition = mentionPositions.find(
      (m) => m.brand.toLowerCase() === lowerBrand || m.brand.toLowerCase() === lowerDomain,
    );
    const mentionPosition = brandPosition?.position ?? null;

    // Extract excerpt (sentence surrounding first mention)
    const responseExcerpt = brandMentioned ? this.extractExcerpt(responseText, brandName, brandDomain) : null;

    // Competitor mentions
    const competitorMentions = mentionPositions
      .filter((m) => m.brand.toLowerCase() !== lowerBrand && m.brand.toLowerCase() !== lowerDomain)
      .map((m) => ({ brand: m.brand, position: m.position }));

    // Basic sentiment analysis
    const sentiment = brandMentioned ? this.analyzeSentiment(responseExcerpt ?? '') : 'neutral';

    return { brandMentioned, mentionPosition, responseExcerpt, competitorMentions, sentiment };
  }

  /**
   * Find all brand mentions and assign ordinal positions based on first appearance.
   */
  private findMentionPositions(
    text: string,
    brands: string[],
    domain: string,
  ): Array<{ brand: string; position: number; index: number }> {
    const lowerText = text.toLowerCase();
    const mentions: Array<{ brand: string; index: number }> = [];

    for (const brand of brands) {
      const lower = brand.toLowerCase();
      const idx = lowerText.indexOf(lower);
      if (idx !== -1) {
        mentions.push({ brand, index: idx });
      }
    }

    // Also check domain
    const lowerDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const domainIdx = lowerText.indexOf(lowerDomain);
    if (domainIdx !== -1 && !mentions.some((m) => m.brand.toLowerCase() === lowerDomain)) {
      mentions.push({ brand: lowerDomain, index: domainIdx });
    }

    // Sort by position in text and assign ordinal
    mentions.sort((a, b) => a.index - b.index);
    return mentions.map((m, i) => ({ ...m, position: i + 1 }));
  }

  /**
   * Extract 1-2 sentences surrounding the first brand mention.
   */
  private extractExcerpt(text: string, brandName: string, brandDomain: string): string {
    const lowerText = text.toLowerCase();
    const lowerBrand = brandName.toLowerCase();
    const lowerDomain = brandDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');

    let idx = lowerText.indexOf(lowerBrand);
    if (idx === -1) idx = lowerText.indexOf(lowerDomain);
    if (idx === -1) return '';

    // Find sentence boundaries
    const sentences = text.split(/(?<=[.!?])\s+/);
    let cumulative = 0;
    for (let i = 0; i < sentences.length; i++) {
      const sentEnd = cumulative + sentences[i].length;
      if (idx >= cumulative && idx < sentEnd) {
        // Return this sentence and possibly the next
        const excerpt = sentences.slice(i, i + 2).join(' ');
        return excerpt.length > 300 ? excerpt.substring(0, 300) + '...' : excerpt;
      }
      cumulative = sentEnd + 1; // +1 for space
    }

    // Fallback: substring around mention
    const start = Math.max(0, idx - 50);
    const end = Math.min(text.length, idx + 200);
    return text.substring(start, end);
  }

  /**
   * Basic keyword-based sentiment detection.
   * A more advanced version would use an LLM call.
   */
  private analyzeSentiment(excerpt: string): 'positive' | 'neutral' | 'negative' {
    const lower = excerpt.toLowerCase();

    const positiveSignals = [
      'best', 'top', 'leading', 'excellent', 'great', 'recommended', 'popular',
      'trusted', 'reliable', 'innovative', 'outstanding', 'superior', 'preferred',
    ];
    const negativeSignals = [
      'worst', 'avoid', 'poor', 'bad', 'unreliable', 'expensive', 'limited',
      'lacking', 'criticized', 'problematic', 'controversial', 'disappointing',
    ];

    const posCount = positiveSignals.filter((w) => lower.includes(w)).length;
    const negCount = negativeSignals.filter((w) => lower.includes(w)).length;

    if (posCount > negCount && posCount >= 1) return 'positive';
    if (negCount > posCount && negCount >= 1) return 'negative';
    return 'neutral';
  }

  /**
   * Calculate rolling visibility percentage from recent results.
   */
  calculateVisibilityPct(recentResults: Array<{ brandMentioned: boolean }>): number {
    if (recentResults.length === 0) return 0;
    const mentioned = recentResults.filter((r) => r.brandMentioned).length;
    return Math.round((mentioned / recentResults.length) * 10000) / 100; // 2 decimal places
  }
}
