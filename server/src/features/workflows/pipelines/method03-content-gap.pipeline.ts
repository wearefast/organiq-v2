import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';

/**
 * Tier 1 pipeline: Method 03 — Content Gap
 * Finds keywords that competitors rank for but target domain doesn't.
 * No LLM needed — pure set-difference logic on API data.
 */
@Injectable()
export class Method03ContentGapPipeline implements Pipeline {
  stepKey = 'method03-content-gap-import';
  private readonly logger = new Logger(Method03ContentGapPipeline.name);

  constructor(private readonly ahrefs: AhrefsService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const competitors = (context.competitors as string[]) || [];
    const country = (context.country as string) || 'us';

    this.logger.log(`Method 03: Finding content gaps for ${domain} vs ${competitors.length} competitors`);

    // Get target domain's current keywords
    const targetKeywordsRaw = await this.ahrefs.getOrganicKeywords(domain, country, 500);
    const targetKeywords = this.extractKeywordSet(targetKeywordsRaw);

    // Get competitor keywords
    const competitorKeywords: Array<{ keyword: string; sourceDomain: string }> = [];

    for (const competitor of competitors) {
      try {
        const kwData = await this.ahrefs.getOrganicKeywords(competitor, country, 200);
        const kwList = this.extractKeywordList(kwData);

        for (const kw of kwList) {
          if (!targetKeywords.has(kw.toLowerCase())) {
            competitorKeywords.push({
              keyword: kw,
              sourceDomain: competitor,
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch keywords for ${competitor}: ${(error as Error).message}`);
      }
    }

    // Deduplicate gaps
    const seen = new Set<string>();
    const gaps = competitorKeywords.filter((item) => {
      const key = item.keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      gaps,
      meta: {
        targetKeywordCount: targetKeywords.size,
        totalGaps: gaps.length,
        competitorsAnalyzed: competitors.length,
        country,
      },
    };
  }

  private extractKeywordSet(response: unknown): Set<string> {
    const set = new Set<string>();
    if (!response || typeof response !== 'object') return set;
    const data = response as Record<string, unknown>;
    const keywords = Array.isArray(data.keywords) ? data.keywords : Array.isArray(data) ? data : [];
    for (const item of keywords as Array<Record<string, unknown>>) {
      const kw = String(item.keyword || '').trim().toLowerCase();
      if (kw) set.add(kw);
    }
    return set;
  }

  private extractKeywordList(response: unknown): string[] {
    if (!response || typeof response !== 'object') return [];
    const data = response as Record<string, unknown>;
    const keywords = Array.isArray(data.keywords) ? data.keywords : Array.isArray(data) ? data : [];
    return (keywords as Array<Record<string, unknown>>)
      .map((item) => String(item.keyword || '').trim())
      .filter(Boolean);
  }
}
