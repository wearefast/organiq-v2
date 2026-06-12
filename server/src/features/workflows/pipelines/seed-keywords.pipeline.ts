import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { AhrefsService } from '../../integrations/ahrefs/ahrefs.service';
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
 * V7 Pipeline: Seed Keywords
 * Fetches seed keywords via Ahrefs organic keywords + related terms + DataForSEO suggestions.
 * Returns raw API responses for agent analysis — NO analysis logic here.
 *
 * Fallback strategy: When the target domain has no organic keyword footprint in
 * Ahrefs (common for new/low-DR sites), the pipeline derives seed terms from the
 * project's industry, business-profile (ICP pain points, positioning), and
 * competitor domains. This ensures the agent always receives keyword evidence.
 *
 * Rate limit strategy: Ahrefs 60 req/min. Batch seeds in groups of 10 with 1s delay.
 */
@Injectable()
export class SeedKeywordsPipeline implements Pipeline {
  stepKey = 'seed-keywords';
  private readonly logger = new Logger(SeedKeywordsPipeline.name);

  constructor(
    private readonly ahrefs: AhrefsService,
    private readonly dataforseo: DataForSeoService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    const country = (context.country as string)?.toLowerCase() || 'us';
    const language = (context.language as string) || 'en';
    const location = COUNTRY_TO_LOCATION[country] || (context.location as string) || 'United States';
    const industry = (context.industry as string) || '';
    const start = Date.now();

    if (!domain) throw new Error('seed-keywords pipeline requires context.domain');

    let apiCallCount = 0;

    // Step 1: Get domain's existing organic keywords (top 50 by traffic)
    this.logger.log(`Seed keywords: fetching organic keywords for ${domain} (country=${country})`);
    const organicRaw = await this.ahrefs.getOrganicKeywords(domain, country, 50);
    apiCallCount++;

    // Step 2: Extract seed terms from organic keywords
    const organicData = organicRaw as { keywords?: Array<Record<string, unknown>> };
    const organicKeywords = this.slimKeywordList(organicData?.keywords ?? []);
    let seedTerms: string[] = organicKeywords.map((k) => k.keyword).filter(Boolean).slice(0, 20);

    // Step 2b: FALLBACK — If no organic keywords, derive seeds from context
    let fallbackUsed = false;
    let competitorOrganicKeywords: Array<{ competitor: string; keywords: SlimKeyword[] }> = [];

    if (seedTerms.length === 0) {
      fallbackUsed = true;
      this.logger.warn(
        `Seed keywords: Ahrefs returned 0 organic keywords for ${domain}. Activating fallback seed generation.`,
      );

      const fallbackSeeds = this.deriveFallbackSeeds(domain, industry, context['business-profile']);

      // Also try to get organic keywords from competitor domains (max 2, 20 kws each)
      const competitorDomains = this.extractCompetitorDomains(context['business-profile']);
      if (competitorDomains.length > 0) {
        this.logger.log(`Seed keywords: fetching competitor organic keywords from ${competitorDomains.length} competitors`);
        const competitorResults = await Promise.all(
          competitorDomains.slice(0, 2).map(async (comp) => {
            try {
              const raw = await this.ahrefs.getOrganicKeywords(comp, country, 20);
              apiCallCount++;
              const rawData = raw as { keywords?: Array<Record<string, unknown>> };
              return { competitor: comp, keywords: this.slimKeywordList(rawData?.keywords ?? []) };
            } catch (err) {
              this.logger.warn(`Competitor organic fetch failed for "${comp}": ${(err as Error).message}`);
              return null;
            }
          }),
        );
        competitorOrganicKeywords = competitorResults.filter(Boolean) as typeof competitorOrganicKeywords;

        // Extract keywords from competitor data as additional seeds
        for (const comp of competitorOrganicKeywords) {
          fallbackSeeds.push(...comp.keywords.map((k) => k.keyword).slice(0, 8));
        }
      }

      // Deduplicate and limit fallback seeds
      seedTerms = [...new Set(fallbackSeeds.map((s) => s.toLowerCase().trim()).filter(Boolean))].slice(0, 15);
      this.logger.log(`Seed keywords: fallback generated ${seedTerms.length} seed terms`);
    }

    // Step 3: For each seed, get related terms + DataForSEO suggestions (10 each max)
    // Batch in groups of 5 with 1s delay between batches (Ahrefs 60 req/min limit)
    const BATCH_SIZE = 5;
    const relatedTermsResults: Array<{ seed: string; keywords: SlimKeyword[] }> = [];
    const suggestionsResults: Array<{ seed: string; keywords: SlimKeyword[] }> = [];

    for (let i = 0; i < seedTerms.length; i += BATCH_SIZE) {
      const batch = seedTerms.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (seed) => {
          try {
            const [relatedRaw, suggestionsRaw] = await Promise.all([
              this.ahrefs.getRelatedKeywords(seed, country, 15),
              this.dataforseo.getKeywordSuggestions(seed, location, language, 15),
            ]);
            apiCallCount += 2;
            const relatedData = relatedRaw as { keywords?: Array<Record<string, unknown>> };
            const suggData = suggestionsRaw as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> };
            relatedTermsResults.push({ seed, keywords: this.slimKeywordList(relatedData?.keywords ?? []) });
            suggestionsResults.push({ seed, keywords: this.slimDfsKeywordList(suggData) });
          } catch (err) {
            this.logger.warn(`Seed expansion failed for "${seed}": ${(err as Error).message}`);
          }
        }),
      );

      // Throttle between batches
      if (i + BATCH_SIZE < seedTerms.length) {
        await sleep(1000);
      }
    }

    return {
      rawData: {
        organicKeywords,
        seedTerms,
        relatedTerms: relatedTermsResults,
        suggestions: suggestionsResults,
        ...(competitorOrganicKeywords.length > 0 ? { competitorOrganicKeywords } : {}),
      },
      metadata: {
        domain,
        country,
        location,
        fallbackUsed,
        seedTermsDiscovered: seedTerms.length,
        apiCallCount,
        durationMs: Date.now() - start,
      },
    };
  }

  /**
   * Slim an Ahrefs keyword array to only the fields the agent needs.
   * Drops URL, position, traffic, etc. — keeps keyword, volume, difficulty, cpc.
   */
  private slimKeywordList(items: Array<Record<string, unknown>>): SlimKeyword[] {
    return items.map((k) => ({
      keyword: String(k['keyword'] ?? k['keyword_phrase'] ?? ''),
      volume: (k['volume'] ?? k['search_volume'] ?? null) as number | null,
      difficulty: (k['keyword_difficulty'] ?? k['difficulty'] ?? null) as number | null,
      cpc: (k['cpc'] ?? null) as number | null,
      // Preserve current SERP position — Ahrefs v3 organic-keywords returns best_position.
      // Downstream steps (phase1-baseline, method02) need this to compute ranking distribution.
      currentPosition: (k['best_position'] ?? null) as number | null,
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
   * Derive seed terms from project context when organic keywords are unavailable.
   * Sources: industry field, business-profile (ICP pain points, positioning, content gaps).
   */
  private deriveFallbackSeeds(domain: string, industry: string, businessProfile: unknown): string[] {
    const seeds: string[] = [];

    // Source 1: Industry terms (split by comma)
    if (industry) {
      const terms = industry.split(/[,/&]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
      seeds.push(...terms);
    }

    // Source 2: Domain name parts (e.g. "luvindeals" → "deals")
    const domainBase = domain.replace(/\.(com|net|org|io|ae|co|uk)$/i, '');
    const domainWords = domainBase.split(/[^a-z]+/i).filter((w) => w.length > 3);
    seeds.push(...domainWords.map((w) => w.toLowerCase()));

    // Source 3: Business profile data
    const bp = businessProfile as {
      icp?: { pain_points?: string[]; industries?: string[] };
      positioning?: string;
      content_gaps?: string[];
      competitors?: string[];
    } | null | undefined;

    if (bp) {
      // ICP pain points → extract key phrases (take first 3-4 words of each)
      if (bp.icp?.pain_points) {
        for (const pp of bp.icp.pain_points.slice(0, 5)) {
          const phrase = pp.split(/\s+/).slice(0, 4).join(' ').toLowerCase()
            .replace(/[^a-z0-9\s]/g, '').trim();
          if (phrase.length > 5) seeds.push(phrase);
        }
      }

      // ICP industries as seeds
      if (bp.icp?.industries) {
        for (const ind of bp.icp.industries.slice(0, 5)) {
          seeds.push(ind.toLowerCase().replace(/[^a-z0-9\s&/]/g, '').trim());
        }
      }

      // Extract key terms from positioning (take noun phrases)
      if (bp.positioning) {
        const posTerms = this.extractKeyPhrases(bp.positioning);
        seeds.push(...posTerms.slice(0, 5));
      }
    }

    return seeds;
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

  /**
   * Extract short key phrases from a text block (positioning, descriptions).
   * Returns lowercase 2-3 word phrases that are likely relevant for keyword research.
   */
  private extractKeyPhrases(text: string): string[] {
    const phrases: string[] = [];
    // Split on punctuation and conjunctions, extract 2-3 word segments
    const segments = text.toLowerCase()
      .replace(/['']/g, "'")
      .split(/[.,;:!?()\[\]{}""—–\-\/\\]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    for (const seg of segments) {
      const words = seg.split(/\s+/).filter((w) => w.length > 2 && !/^(the|and|for|with|from|that|this|are|was|will|has|been|its|all|can|also)$/.test(w));
      if (words.length >= 2 && words.length <= 4) {
        phrases.push(words.join(' '));
      } else if (words.length > 4) {
        // Take first 3 meaningful words
        phrases.push(words.slice(0, 3).join(' '));
      }
    }
    return phrases;
  }
}
