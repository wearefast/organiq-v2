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
    // Normalise: "Mashreq 4" → "Mashreq", "Acme Corp 2" → "Acme Corp"
    const cleanBrand = brandName.replace(/[\s\-_]+\d+$/, '').trim() || brandName;

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
    const lowerBrand = cleanBrand.toLowerCase();
    const lowerDomain = brandDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');

    // Also check the first significant word of the brand (handles "Mashreq" when brand is "Mashreq Bank")
    const brandFirstWord = lowerBrand.split(/\s+/)[0];
    const useFirstWord = brandFirstWord.length >= 5 && lowerBrand.includes(' ');

    // Detect brand mention (full name OR domain OR first significant word)
    const brandMentioned =
      lowerText.includes(lowerBrand) ||
      lowerText.includes(brandName.toLowerCase()) ||
      lowerText.includes(lowerDomain) ||
      (useFirstWord && lowerText.includes(brandFirstWord));

    // Find position: prefer numbered/bulleted list rank (AI typically lists banks 1. 2. 3.)
    // Fall back to ordinal rank among configured competitors only when no list is detected.
    const listPosition = brandMentioned ? this.findListPosition(responseText, cleanBrand, brandDomain) : null;

    let mentionPosition: number | null = listPosition;
    if (mentionPosition === null && brandMentioned && competitors.length > 0) {
      // Ordinal fallback: only meaningful when competitors are configured.
      // With no competitors, this would always return position 1 (only brand in the array).
      const allBrands = [cleanBrand, ...competitors];
      const mentionPositions = this.findMentionPositions(responseText, allBrands, brandDomain);
      const brandPos = mentionPositions.find(
        (m) => m.brand.toLowerCase() === lowerBrand || m.brand.toLowerCase() === lowerDomain,
      );
      mentionPosition = brandPos?.position ?? null;
    }

    // Competitor mentions (only used when falling back to ordinal mode)
    const allBrandsForComp = [cleanBrand, ...competitors];
    const mentionPositionsForComp = this.findMentionPositions(responseText, allBrandsForComp, brandDomain);
    const competitorMentions = mentionPositionsForComp
      .filter((m) => m.brand.toLowerCase() !== lowerBrand && m.brand.toLowerCase() !== lowerDomain)
      .map((m) => ({ brand: m.brand, position: m.position }));

    // Extract excerpt (sentence surrounding first mention)
    const responseExcerpt = brandMentioned ? this.extractExcerpt(responseText, cleanBrand, brandDomain) : null;

    // Basic sentiment analysis
    const sentiment = brandMentioned ? this.analyzeSentiment(responseExcerpt ?? '') : 'neutral';

    return { brandMentioned, mentionPosition, responseExcerpt, competitorMentions, sentiment };
  }

  /**
   * Detect the brand's position in a numbered or lettered list within the AI response.
   * AI models typically respond to "which bank..." queries with ranked lists:
   *   1. Emirates NBD\n2. Mashreq NEO\n3. ...
   * Returns the 1-based list position if found, null otherwise.
   */
  private findListPosition(
    text: string,
    brandName: string,
    brandDomain: string,
  ): number | null {
    const lowerBrand = brandName.toLowerCase();
    const lowerDomain = brandDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    // Also match the first significant word (handles "Mashreq" when brand is "Mashreq Bank")
    const brandFirstWord = lowerBrand.split(/\s+/)[0];
    const useFirstWord = brandFirstWord.length >= 5 && lowerBrand.includes(' ');
    const matchesBrand = (s: string) =>
      s.includes(lowerBrand) || s.includes(lowerDomain) || (useFirstWord && s.includes(brandFirstWord));

    // ── Strategy 1: plain numbered list ───────────────────────────────
    // "1. Bank" / "1) Bank" / "(1) Bank" — most reliable, used by OpenAI, Perplexity, Gemini
    const numberedListRegex = /(?:^|\n)[ \t]*(?:\(\d+\)|\d+[.):\s])[ \t]*([^\n]{3,120})/gm;
    const numListItems: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = numberedListRegex.exec(text)) !== null) {
      numListItems.push(m[1].toLowerCase());
    }
    if (numListItems.length >= 2) {
      for (let i = 0; i < numListItems.length; i++) {
        if (matchesBrand(numListItems[i])) {
          return i + 1;
        }
      }
    }

    // ── Strategy 2: numbered markdown headings ─────────────────────────
    // "### 1. **Bank**" / "## 6. Mashreq" — reads the EXPLICIT number from the heading.
    // Claude often uses this format. More reliable than counting indices.
    const numberedHeadingRegex = /(?:^|\n)#{1,4}[ \t]+(\d+)[.):\s]+\**([^*\n]{3,100}?)\**[ \t]*(?:\n|$)/gm;
    while ((m = numberedHeadingRegex.exec(text)) !== null) {
      const explicitRank = parseInt(m[1], 10);
      const headingText = m[2].toLowerCase().trim();
      if (matchesBrand(headingText)) {
        return explicitRank; // Use the AI's own number, not our count
      }
    }

    // ── Strategy 3: sequential heading list (no number) ───────────────
    // "### **Emirates NBD**" / "### Bank Name" — count sequence, filter section labels
    const headingSeqRegex = /(?:^|\n)(#{1,4})[ \t]+\**([^*\n]{2,70}?)\**[ \t]*(?:\n|$)/gm;
    const headingEntries: string[] = [];
    while ((m = headingSeqRegex.exec(text)) !== null) {
      const level = m[1].length;
      const title = m[2].replace(/\*\*/g, '').trim();
      if (!title || title.endsWith(':')) continue;
      // Skip h1/h2 section labels (generic phrases that introduce the list)
      if (level <= 2 && /^(top|best|specialized|general|overview|summary|comparison|additional|conclusion|current|ranked|recommended|introduction|background)/i.test(title)) continue;
      // Skip sub-category headers at any level ("For International Banking")
      if (/^for\s/i.test(title)) continue;
      headingEntries.push(title.toLowerCase());
    }
    if (headingEntries.length >= 2) {
      for (let i = 0; i < headingEntries.length; i++) {
        if (matchesBrand(headingEntries[i])) {
          return i + 1;
        }
      }
    }

    // ── Strategy 4: bold entity at line start ─────────────────────────
    // "**Bank Name** - description" or "### **Bank Name**" — at line start, single entity.
    // Skip: ends with ":", > 60 chars (multi-bank comma list), generic labels.
    const boldLineRegex = /(?:^|\n)[ \t]*(?:#{1,4}[ \t]+)?(?:\d+[.):\s]+)?\*\*([^*\n]{2,60}?)\*\*/gm;
    const boldEntities: string[] = [];
    while ((m = boldLineRegex.exec(text)) !== null) {
      const entity = m[1].trim();
      if (!entity || entity.endsWith(':')) continue;
      if (entity.includes(',')) continue; // commas = multi-bank list → handled by Strategy 5
      if (/^(key features?|note|summary|overview|best for|pros|cons|tip|important|conclusion|current|for\s|best |top |the |most |these |all )/i.test(entity)) continue;
      boldEntities.push(entity.toLowerCase());
    }
    if (boldEntities.length >= 2) {
      for (let i = 0; i < boldEntities.length; i++) {
        if (matchesBrand(boldEntities[i])) {
          return i + 1;
        }
      }
    }

    // ── Strategy 5: comma-separated bold list ─────────────────────────
    // Perplexity: "**Emirates NBD, First Abu Dhabi Bank (FAB), Mashreq, ADCB, RAKBANK**"
    // The entire inline ranking is one bold block. Split and find position.
    const boldCommaRegex = /\*\*([^*\n]*,[^*\n]*)\*\*/g;
    while ((m = boldCommaRegex.exec(text)) !== null) {
      const parts = m[1]
        .split(/,\s*(?:and\s+)?/i)
        .map((p) => p.replace(/\*\*/g, '').trim().toLowerCase())
        .filter((p) => p.length > 1);
      if (parts.length >= 2) {
        for (let i = 0; i < parts.length; i++) {
          if (matchesBrand(parts[i])) {
            return i + 1;
          }
        }
      }
    }

    return null;
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
