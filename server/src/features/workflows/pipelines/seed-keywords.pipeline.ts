import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface SlimKeyword {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  currentPosition: number | null;
}

/** Maps country codes to DataForSEO location names (subset for seed pipeline). */
const COUNTRY_TO_LOCATION: Record<string, string> = {
  us: 'United States', uk: 'United Kingdom', gb: 'United Kingdom',
  ca: 'Canada', au: 'Australia', de: 'Germany', fr: 'France',
  es: 'Spain', it: 'Italy', br: 'Brazil', in: 'India', jp: 'Japan',
  sa: 'Saudi Arabia', ae: 'United Arab Emirates', uae: 'United Arab Emirates',
  eg: 'Egypt', sg: 'Singapore', my: 'Malaysia', id: 'Indonesia',
  tr: 'Turkey', nl: 'Netherlands', se: 'Sweden', no: 'Norway',
  dk: 'Denmark', fi: 'Finland', pl: 'Poland', za: 'South Africa',
  mx: 'Mexico', ar: 'Argentina', cl: 'Chile', co: 'Colombia',
  ph: 'Philippines', th: 'Thailand', vn: 'Vietnam', kr: 'South Korea',
  tw: 'Taiwan', hk: 'Hong Kong', nz: 'New Zealand', ie: 'Ireland',
};

/**
 * V8 Pipeline: Seed Keywords — Competitor-Gap Discovery
 *
 * Strategy:
 *  1. Fetch domain's current rankings as an EXCLUSION baseline (not seeds).
 *  2. Always fetch top competitors' rankings — competitor keywords the domain
 *     does NOT rank for are the highest-signal seed candidates.
 *  3. Extract business seeds from business-profile.primary_services for
 *     offering-anchored topical coverage.
 *  4. Merge gap seeds + business seeds → feed into DataForSEO suggestions.
 *
 * Fallback: when no competitors are available, business seeds carry the full load.
 */
@Injectable()
export class SeedKeywordsPipeline implements Pipeline {
  stepKey = 'seed-keywords';
  private readonly logger = new Logger(SeedKeywordsPipeline.name);

  constructor(
    private readonly dataforseo: DataForSeoService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string)?.toLowerCase() || 'us';
    const language = (context.language as string) || 'en';
    const location = COUNTRY_TO_LOCATION[country] || (context.location as string) || 'United States';
    const start = Date.now();

    if (!domain) throw new Error('seed-keywords pipeline requires context.domain');

    let apiCallCount = 0;

    // ─── Step 1: Domain baseline — what the domain ALREADY ranks for ─────────
    // Used as an exclusion list only; these are NOT seeds.
    this.logger.log(`Seed keywords: fetching domain baseline for ${domain}`);
    let domainRankings: SlimKeyword[] = [];
    try {
      const domainRaw = await this.dataforseo.getRankedKeywords(domain, location, language, 50);
      apiCallCount++;
      domainRankings = this.slimDfsRankedKeywords(domainRaw);
    } catch (err) {
      this.logger.warn(`Domain baseline fetch failed for "${domain}": ${(err as Error).message}`);
    }
    const domainKeywordSet = new Set(domainRankings.map((k) => k.keyword.toLowerCase().trim()));

    // ─── Step 2: Competitor rankings — always primary, not fallback ──────────
    const competitorDomains = this.extractCompetitorDomains(context['business-profile']);
    const competitorRankings: Array<{ competitor: string; keywords: SlimKeyword[] }> = [];

    if (competitorDomains.length > 0) {
      this.logger.log(`Seed keywords: fetching rankings for ${Math.min(competitorDomains.length, 3)} competitors`);
      const competitorResults = await Promise.all(
        competitorDomains.slice(0, 3).map(async (comp) => {
          try {
            const raw = await this.dataforseo.getRankedKeywords(comp, location, language, 50);
            apiCallCount++;
            return { competitor: comp, keywords: this.slimDfsRankedKeywords(raw) };
          } catch (err) {
            this.logger.warn(`Competitor baseline fetch failed for "${comp}": ${(err as Error).message}`);
            return null;
          }
        }),
      );
      competitorRankings.push(...(competitorResults.filter(Boolean) as typeof competitorRankings));
    }

    // ─── Step 3: Gap computation — competitor keywords the domain doesn't rank for
    const allCompetitorKeywords: SlimKeyword[] = [];
    for (const comp of competitorRankings) {
      for (const kw of comp.keywords) {
        if (kw.keyword && !domainKeywordSet.has(kw.keyword.toLowerCase().trim())) {
          allCompetitorKeywords.push(kw);
        }
      }
    }

    // Deduplicate by keyword string, keeping the entry with the highest volume
    const gapMap = new Map<string, SlimKeyword>();
    for (const kw of allCompetitorKeywords) {
      const key = kw.keyword.toLowerCase().trim();
      const existing = gapMap.get(key);
      if (!existing || (kw.volume ?? 0) > (existing.volume ?? 0)) {
        gapMap.set(key, kw);
      }
    }
    // Sort by volume descending — highest-signal gaps first
    const gapKeywords = [...gapMap.values()]
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 30);

    this.logger.log(`Seed keywords: ${gapKeywords.length} gap keywords computed from ${competitorRankings.length} competitors`);

    // ─── Step 4: Business seeds from primary_services ─────────────────────────
    const businessSeeds = this.extractBusinessSeeds(context['business-profile']);
    this.logger.log(`Seed keywords: ${businessSeeds.length} business seeds from primary_services`);

    // ─── Step 5: Merge gap seeds + business seeds for suggestion expansion ────
    const gapSeedTerms = gapKeywords.slice(0, 15).map((k) => k.keyword.toLowerCase().trim());
    const mergedSeeds = [...new Set([...gapSeedTerms, ...businessSeeds])].slice(0, 20);

    // Activate fallback message when no competitor data was available
    const fallbackUsed = competitorRankings.length === 0;
    if (fallbackUsed) {
      this.logger.warn(`Seed keywords: no competitor data — relying on business seeds only (${mergedSeeds.length} seeds)`);
    }

    // ─── Step 6: DataForSEO keyword suggestions per seed ─────────────────────
    const BATCH_SIZE = 5;
    const suggestionsResults: Array<{ seed: string; keywords: SlimKeyword[] }> = [];

    for (let i = 0; i < mergedSeeds.length; i += BATCH_SIZE) {
      const batch = mergedSeeds.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (seed) => {
          try {
            const suggestionsRaw = await this.dataforseo.getKeywordSuggestions(seed, location, language, 25);
            apiCallCount++;
            const suggData = suggestionsRaw as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> };
            suggestionsResults.push({ seed, keywords: this.slimDfsKeywordList(suggData) });
          } catch (err) {
            this.logger.warn(`Seed expansion failed for "${seed}": ${(err as Error).message}`);
          }
        }),
      );

      if (i + BATCH_SIZE < mergedSeeds.length) {
        await sleep(500);
      }
    }

    return {
      rawData: {
        gapKeywords,
        domainRankings,
        competitorRankings,
        seedTerms: mergedSeeds,
        // Keep legacy key so any dead-code checks in downstream steps don't throw
        relatedTerms: suggestionsResults,
        suggestions: suggestionsResults,
      },
      metadata: {
        domain,
        country,
        location,
        fallbackUsed,
        gapCount: gapKeywords.length,
        seedTermsDiscovered: mergedSeeds.length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }

  /**
   * Slim a DataForSEO ranked_keywords response to SlimKeyword[].
   * Maps items[].keyword_data + ranked_serp_element into the standard shape.
   */
  private slimDfsRankedKeywords(raw: unknown): SlimKeyword[] {
    const data = raw as {
      tasks?: Array<{
        result?: Array<{
          items?: Array<{
            keyword_data?: {
              keyword?: string;
              keyword_info?: { search_volume?: number; cpc?: number };
              keyword_properties?: { keyword_difficulty?: number };
            };
            ranked_serp_element?: {
              serp_item?: { rank_group?: number };
            };
          }>;
        }>;
      }>;
    };
    const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    return items.map((item) => ({
      keyword: String(item.keyword_data?.keyword ?? ''),
      volume: (item.keyword_data?.keyword_info?.search_volume ?? null) as number | null,
      difficulty: (item.keyword_data?.keyword_properties?.keyword_difficulty ?? null) as number | null,
      cpc: (item.keyword_data?.keyword_info?.cpc ?? null) as number | null,
      currentPosition: (item.ranked_serp_element?.serp_item?.rank_group ?? null) as number | null,
    })).filter((k) => k.keyword.length > 0);
  }

  /**
   * Slim a DataForSEO keyword_suggestions response to SlimKeyword[].
   */
  private slimDfsKeywordList(
    raw: { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> },
  ): SlimKeyword[] {
    const items = raw?.tasks?.[0]?.result?.[0]?.items ?? [];
    return items.map((k) => ({
      keyword: String(k['keyword'] ?? ''),
      volume: (k['search_volume'] ?? k['volume'] ?? null) as number | null,
      difficulty: (k['keyword_difficulty'] ?? k['difficulty'] ?? null) as number | null,
      cpc: (k['cpc'] ?? null) as number | null,
      currentPosition: null, // DataForSEO suggestions have no ranking position data
    })).filter((k) => k.keyword.length > 0);
  }

  /**
   * Extract seed terms from business-profile.primary_services.
   * Each service name is trimmed to 2–4 words — precise enough to anchor a
   * suggestion query without being too generic.
   */
  private extractBusinessSeeds(businessProfile: unknown): string[] {
    const bp = businessProfile as { primary_services?: string[] } | null | undefined;
    if (!bp?.primary_services?.length) return [];

    return bp.primary_services
      .slice(0, 10)
      .map((s) =>
        s.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 4)
          .join(' '),
      )
      .filter((s) => s.length > 3);
  }

  /**
   * Extract competitor domains from business-profile.competitors array.
   * Handles formats like "Company Name - domain.com" or just "domain.com".
   */
  private extractCompetitorDomains(businessProfile: unknown): string[] {
    const bp = businessProfile as { competitors?: string[] } | null | undefined;
    if (!bp?.competitors) return [];

    const domains: string[] = [];
    for (const comp of bp.competitors) {
      // Try to extract domain from patterns like "Name - domain.com" or "Name (domain.com)"
      const domainMatch = comp.match(/[\w-]+\.\w{2,}(?:\.\w{2,})?/g);
      if (domainMatch) {
        // Take the last domain-like match (usually the actual domain)
        domains.push(domainMatch[domainMatch.length - 1].toLowerCase());
      }
    }
    return [...new Set(domains)];
  }
}
