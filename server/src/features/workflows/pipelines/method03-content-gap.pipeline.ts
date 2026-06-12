import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';

/**
 * V7 Pipeline: Method 03 — Content Gap
 * Fetches organic keywords for target domain and all competitors via DataForSEO API.
 * Falls back to competitor-metrics keyword data when API returns 0 gap keywords
 * (e.g. when local-market data is sparse for low-DR domains).
 */
@Injectable()
export class Method03ContentGapPipeline implements Pipeline {
  stepKey = 'method03-content-gap-import';
  private readonly logger = new Logger(Method03ContentGapPipeline.name);

  constructor(private readonly dataforseo: DataForSeoService) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    try {
      return await this._execute(context);
    } catch (err) {
      this.logger.error(`Method 03 pipeline crash: ${(err as Error).message}\n${(err as Error).stack}`);
      throw err;
    }
  }

  private async _execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;

    const bucketsCtx = context['competitor-buckets'] as {
      buckets?: {
        direct?: { competitors?: Array<{ domain: string }> };
        content?: { competitors?: Array<{ domain: string }> };
      };
      rawData?: { competingDomains?: { competitors?: Array<{ competitor_domain?: string }> } };
    } | undefined;

    // Support both old agent schema and new pipeline schema
    let competitors: string[] = [];
    if (bucketsCtx?.buckets) {
      const direct = Array.isArray(bucketsCtx.buckets.direct?.competitors) ? bucketsCtx.buckets.direct!.competitors! : [];
      const content = Array.isArray(bucketsCtx.buckets.content?.competitors) ? bucketsCtx.buckets.content!.competitors! : [];
      competitors = [...direct, ...content].map((c) => c.domain).filter(Boolean);
    } else if (bucketsCtx?.rawData?.competingDomains) {
      const cd = bucketsCtx.rawData.competingDomains as { competitors?: unknown };
      const cdArr = Array.isArray(cd.competitors) ? cd.competitors as Array<{ competitor_domain?: string }> : [];
      competitors = cdArr.map((c) => c.competitor_domain ?? '').filter(Boolean);
    }

    // Also accept competitors directly from context (e.g. test inputs)
    if (competitors.length === 0 && Array.isArray(context.competitors)) {
      competitors = (context.competitors as string[]).filter(Boolean);
    }

    const country = (context.country as string) || 'us';
    const start = Date.now();
    let apiCallCount = 0;

    this.logger.log(`Method 03: fetching keywords for ${domain} + ${competitors.length} competitors using DataForSEO`);

    const extractDataforseoKeywords = (res: any): Array<{ keyword: string; volume: number; keyword_difficulty: number }> => {
      const rawItems = res?.tasks?.[0]?.result?.[0]?.items;
      const items: any[] = Array.isArray(rawItems) ? rawItems : [];
      return items.map((item: any) => ({
        keyword: item?.keyword_data?.keyword || item?.keyword || '',
        volume: item?.keyword_data?.keyword_info?.search_volume ?? item?.search_volume ?? 0,
        keyword_difficulty: item?.keyword_data?.keyword_properties?.keyword_difficulty ?? item?.keyword_difficulty ?? 0,
      })).filter((k: any) => Boolean(k.keyword));
    };

    // Target domain keywords (up to 500 for gap analysis)
    const targetResult = await this.dataforseo.getRankedKeywords(domain, country, 'en', 500);
    apiCallCount++;

    const targetKeywords = extractDataforseoKeywords(targetResult);
    const targetKeywordSet = new Set(targetKeywords.map((k) => k.keyword.toLowerCase()));

    // Competitor keywords (up to 200 each)
    const competitorKeywordsResults: Array<{ domain: string; data: unknown }> = [];
    const gapMap = new Map<string, { keyword: string; sources: string[]; [k: string]: unknown }>();

    for (const competitor of competitors) {
      try {
        const kwData = await this.dataforseo.getRankedKeywords(competitor, country, 'en', 200);
        apiCallCount++;
        competitorKeywordsResults.push({ domain: competitor, data: kwData });

        const compKeywords = extractDataforseoKeywords(kwData);

        // Identify gap: competitor keywords NOT in target set
        for (const kw of compKeywords) {
          const lower = kw.keyword.toLowerCase();
          if (!targetKeywordSet.has(lower)) {
            const existing = gapMap.get(lower);
            if (existing) {
              existing.sources.push(competitor);
            } else {
              gapMap.set(lower, { ...kw, keyword: kw.keyword, sources: [competitor] as string[] });
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch keywords for ${competitor}: ${(err as Error).message}\n${(err as Error).stack}`);
        competitorKeywordsResults.push({ domain: competitor, data: null });
      }
    }

    const gaps = Array.from(gapMap.values());
    const toArr = (v: unknown): any[] => Array.isArray(v) ? v : [];

    // Fallback: if Ahrefs returned 0 gap keywords (sparse local-market data or API errors),
    // reuse the keywords already fetched by competitor-metrics (limit=20 per competitor).
    // This guarantees the agent always receives data to work with for new/low-DR domains.
    if (gaps.length === 0 && competitors.length > 0) {
      this.logger.warn(`Method 03: Ahrefs returned 0 gap keywords for ${country}. Falling back to competitor-metrics keyword data.`);
      const cmCtx = context['competitor-metrics'] as {
        competitorMetrics?: Array<{
          domain: string;
          keywords?: Array<{ keyword: string; volume: number; difficulty: number; position: number | null }>;
        }>;
      } | undefined;
      for (const cm of toArr(cmCtx?.competitorMetrics)) {
        for (const kw of toArr(cm.keywords)) {
          const lower = kw.keyword.toLowerCase();
          if (!targetKeywordSet.has(lower)) {
            const existing = gapMap.get(lower);
            if (existing) {
              (existing.sources as string[]).push(cm.domain);
            } else {
              gapMap.set(lower, {
                keyword: kw.keyword,
                volume: kw.volume,
                keyword_difficulty: kw.difficulty,
                sources: [cm.domain],
              });
            }
          }
        }
      }
    }

    const fallbackUsed = gaps.length === 0 && gapMap.size > 0;
    const finalGaps = Array.from(gapMap.values());

    // ─── Dedup against prior steps ────────────────────────────────────────
    const priorKeywords = new Set<string>();

    // phase1-baseline keywords
    const p1 = context['phase1-baseline'] as any;
    for (const kw of toArr(p1?.currentRankings)) { if (kw?.keyword) priorKeywords.add(kw.keyword.toLowerCase()); }
    for (const kw of toArr(p1?.keywordGaps)) { if (kw?.keyword) priorKeywords.add(kw.keyword.toLowerCase()); }

    // method01 keywords
    const m1 = context['method01-competitor-pages'] as any;
    for (const kw of toArr(m1?.discoveredKeywords)) { if (kw?.keyword) priorKeywords.add(kw.keyword.toLowerCase()); }

    // method02 keywords
    const m2 = context['method02-seed-expansion'] as any;
    for (const kw of toArr(m2?.expandedKeywords)) { if (kw?.keyword) priorKeywords.add(kw.keyword.toLowerCase()); }

    this.logger.log(`Method 03: ${finalGaps.length} raw gaps, ${priorKeywords.size} prior keywords for dedup`);

    // Filter, dedup, clean
    const afterCleaning = finalGaps
      .filter(g => (g.volume as number ?? 0) > 0)
      .slice(0, 500);

    const afterDedup = afterCleaning.filter(g => !priorKeywords.has(g.keyword.toLowerCase()));
    const duplicatesRemoved = afterCleaning.length - afterDedup.length;

    // ─── Classify intent & score ──────────────────────────────────────────
    const classifyIntent = (kw: string): { intent: string; funnelStage: string; weight: number } => {
      const lower = kw.toLowerCase();
      if (/\b(buy|price|cost|cheap|discount|deal|coupon|order|purchase|shop)\b/.test(lower))
        return { intent: 'transactional', funnelStage: 'BOFU', weight: 0.9 };
      if (/\b(best|top|review|vs|compare|alternative|recommend)\b/.test(lower))
        return { intent: 'commercial', funnelStage: 'MOFU', weight: 0.7 };
      if (/\b(login|sign.?in|official|website|app)\b/.test(lower))
        return { intent: 'navigational', funnelStage: 'BOFU', weight: 0.3 };
      return { intent: 'informational', funnelStage: 'TOFU', weight: 0.5 };
    };

    // Find max volume for normalization
    const maxVol = Math.max(1, ...afterDedup.map(g => (g.volume as number) || 1));

    const importedKeywords = afterDedup.map(g => {
          const vol = Number(g.volume) || 0;
          const diff = (g.keyword_difficulty as number) || 0;
          const { intent, funnelStage, weight } = classifyIntent(g.keyword);
          const volNorm = vol / maxVol;
          const opportunityScore = Math.round(((volNorm * 0.4) + (((100 - diff) / 100) * 0.4) + (weight * 0.2)) * 100) / 100;
          const rawSources = g.sources;
          const sourcesArr: string[] = Array.isArray(rawSources) ? rawSources : (rawSources ? [String(rawSources)] : []);
          return {
            keyword: g.keyword,
            volume: vol,
            difficulty: diff,
            intent,
            funnelStage,
            source: sourcesArr.join(', '),
            opportunityScore,
            isNew: true,
          };
    });

    // Sort by opportunity score descending
    importedKeywords.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // ─── Build bySource ───────────────────────────────────────────────────
    const sourceMap = new Map<string, { count: number; totalVolume: number; difficulties: number[] }>();
    for (const kw of importedKeywords) {
      for (const src of kw.source.split(', ')) {
        const existing = sourceMap.get(src);
        if (existing) {
          existing.count++;
          existing.totalVolume += kw.volume;
          existing.difficulties.push(kw.difficulty);
        } else {
          sourceMap.set(src, { count: 1, totalVolume: kw.volume, difficulties: [kw.difficulty] });
        }
      }
    }
    const bySource = Array.from(sourceMap.entries()).map(([source, s]) => ({
      source,
      count: s.count,
      totalVolume: s.totalVolume,
      avgDifficulty: Math.round(s.difficulties.reduce((a, b) => a + b, 0) / s.difficulties.length),
    }));

    // ─── Build topic clusters (simple keyword grouping) ───────────────────
    const clusterMap = new Map<string, typeof importedKeywords>();
    for (const kw of importedKeywords) {
      const words = kw.keyword.toLowerCase().split(/\s+/);
      const topic = words.length > 2 ? words.slice(0, 2).join(' ') : words[0] || 'general';
      const cluster = clusterMap.get(topic) || [];
      cluster.push(kw);
      clusterMap.set(topic, cluster);
    }
    const topicClusters = Array.from(clusterMap.entries())
      .map(([topic, kws]) => ({
        topic,
        keywordCount: kws.length,
        totalVolume: kws.reduce((s, k) => s + k.volume, 0),
        avgDifficulty: Math.round(kws.reduce((s, k) => s + k.difficulty, 0) / kws.length),
        topKeywords: kws.slice(0, 5).map(k => k.keyword),
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);

    // ─── Summary ──────────────────────────────────────────────────────────
    const totalVolume = importedKeywords.reduce((s, k) => s + k.volume, 0);
    const avgDifficulty = importedKeywords.length > 0
      ? Math.round(importedKeywords.reduce((s, k) => s + k.difficulty, 0) / importedKeywords.length)
      : 0;
    const avgOpportunityScore = importedKeywords.length > 0
      ? Math.round(importedKeywords.reduce((s, k) => s + k.opportunityScore, 0) / importedKeywords.length * 100) / 100
      : 0;
    const topSource = bySource.sort((a, b) => b.count - a.count)[0]?.source || '';

    this.logger.log(`Method 03: completed — ${importedKeywords.length} unique keywords after dedup (${duplicatesRemoved} removed), fallback=${fallbackUsed}`);

    return {
      importedKeywords,
      importStats: {
        totalImported: finalGaps.length,
        afterCleaning: afterCleaning.length,
        afterDedup: afterDedup.length,
        newUnique: importedKeywords.length,
        duplicatesRemoved,
        enriched: 0,
      },
      bySource,
      topicClusters,
      summary: {
        totalNewKeywords: importedKeywords.length,
        totalVolume,
        avgDifficulty,
        avgOpportunityScore,
        topSource,
        recommendation: importedKeywords.length > 0
          ? `Found ${importedKeywords.length} content gap keywords from ${competitors.length} competitors. Focus on ${topSource} gaps for quick wins.`
          : `No content gap keywords found for ${domain} in ${country}. Consider expanding competitor set or targeting adjacent markets.`,
      },
    };
  }
}
