import { Injectable, Logger } from '@nestjs/common';
import { Pipeline } from './pipeline.interface';

/**
 * V7 Pipeline: Consolidated Keywords
 * Merges keywords from all discovery methods (seed, method01, method02, method03),
 * deduplicates by keyword text (case-insensitive), normalizes fields, and
 * computes a final opportunity score.
 *
 * Replaces the former agent-only execution — no LLM needed for mechanical merge/dedup.
 */
@Injectable()
export class ConsolidatedKeywordsPipeline implements Pipeline {
  stepKey = 'consolidated-keywords';
  private readonly logger = new Logger(ConsolidatedKeywordsPipeline.name);

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const seeds = this.extractSeeds(context);
    const method01 = this.extractMethod01(context);
    const method02 = this.extractMethod02(context);
    const method03 = this.extractMethod03(context);
    const baseline = this.extractBaseline(context);

    this.logger.log(
      `Consolidating: seeds=${seeds.length}, method01=${method01.length}, method02=${method02.length}, method03=${method03.length}`,
    );

    // Merge all sources into a single array with normalized schema
    const allKeywords: NormalizedKeyword[] = [
      ...seeds,
      ...method01,
      ...method02,
      ...method03,
    ];

    // Deduplicate: keep the entry with the highest opportunityScore for each unique keyword
    const deduped = this.dedup(allKeywords);

    // Enrich with baseline data (mark current rankings)
    this.enrichWithBaseline(deduped, baseline);

    // Sort by opportunityScore desc, then volume desc
    deduped.sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.volume - a.volume));

    // Build topic clusters from the deduped set
    const topicClusters = this.buildTopicClusters(deduped);

    // Stats
    const stats = {
      totalBeforeDedup: allKeywords.length,
      afterDedup: deduped.length,
      bySources: this.countBySource(deduped),
      byIntent: this.countByIntent(deduped),
      byFunnel: this.countByFunnel(deduped),
      totalVolume: deduped.reduce((sum, k) => sum + k.volume, 0),
      avgDifficulty: deduped.length > 0
        ? Math.round(deduped.reduce((sum, k) => sum + k.difficulty, 0) / deduped.length)
        : 0,
      avgOpportunityScore: deduped.length > 0
        ? Math.round((deduped.reduce((sum, k) => sum + k.opportunityScore, 0) / deduped.length) * 100) / 100
        : 0,
    };

    this.logger.log(
      `Consolidation complete: ${stats.totalBeforeDedup} → ${stats.afterDedup} keywords (${stats.totalBeforeDedup - stats.afterDedup} duplicates removed)`,
    );

    return {
      keywords: deduped,
      topicClusters,
      stats,
    };
  }

  // ─── Extraction Helpers ──────────────────────────────────────

  private extractSeeds(context: Record<string, unknown>): NormalizedKeyword[] {
    const data = context['seed-keywords'] as { seedKeywords?: SeedKeyword[] } | undefined;
    if (!data?.seedKeywords) return [];

    return data.seedKeywords
      .filter((k) => k.keyword && k.volume != null && k.volume > 0)
      .map((k) => ({
        keyword: k.keyword.toLowerCase().trim(),
        volume: k.volume ?? 0,
        difficulty: k.difficulty ?? 0,
        intent: this.normalizeIntent(k.intent),
        funnelStage: this.normalizeFunnel(this.intentToFunnel(k.intent)),
        opportunityScore: k.relevanceScore ?? this.computeOpportunityScore(k.volume ?? 0, k.difficulty ?? 0),
        source: 'seed-keywords',
      }));
  }

  private extractMethod01(context: Record<string, unknown>): NormalizedKeyword[] {
    const data = context['method01-competitor-pages'] as { discoveredKeywords?: Method01Keyword[] } | undefined;
    if (!data?.discoveredKeywords) return [];

    return data.discoveredKeywords
      .filter((k) => k.keyword)
      .map((k) => ({
        keyword: k.keyword.toLowerCase().trim(),
        volume: k.volume ?? 0,
        difficulty: k.difficulty ?? 0,
        intent: this.normalizeIntent(k.intent),
        funnelStage: this.normalizeFunnel(k.funnelStage),
        opportunityScore: k.opportunityScore ?? this.computeOpportunityScore(k.volume ?? 0, k.difficulty ?? 0),
        source: 'method01-competitor-pages',
      }));
  }

  private extractMethod02(context: Record<string, unknown>): NormalizedKeyword[] {
    const data = context['method02-seed-expansion'] as {
      expandedKeywords?: Method02Keyword[];
      questionKeywords?: QuestionKeyword[];
    } | undefined;
    if (!data) return [];

    const expanded = (data.expandedKeywords ?? [])
      .filter((k) => k.keyword)
      .map((k) => ({
        keyword: k.keyword.toLowerCase().trim(),
        volume: k.volume ?? 0,
        difficulty: k.difficulty ?? 0,
        intent: this.normalizeIntent(k.intent),
        funnelStage: this.normalizeFunnel(k.funnelStage),
        opportunityScore: k.opportunityScore ?? this.computeOpportunityScore(k.volume ?? 0, k.difficulty ?? 0),
        source: 'method02-seed-expansion',
      }));

    const questions = (data.questionKeywords ?? [])
      .filter((k) => k.keyword)
      .map((k) => ({
        keyword: k.keyword.toLowerCase().trim(),
        volume: k.volume ?? 0,
        difficulty: 0,
        intent: 'informational' as Intent,
        funnelStage: 'TOFU' as FunnelStage,
        opportunityScore: this.computeOpportunityScore(k.volume ?? 0, 0),
        source: 'method02-seed-expansion',
      }));

    return [...expanded, ...questions];
  }

  private extractMethod03(context: Record<string, unknown>): NormalizedKeyword[] {
    const data = context['method03-content-gap-import'] as { importedKeywords?: Method03Keyword[] } | undefined;
    if (!data?.importedKeywords) return [];

    return data.importedKeywords
      .filter((k) => k.keyword)
      .map((k) => ({
        keyword: k.keyword.toLowerCase().trim(),
        volume: k.volume ?? 0,
        difficulty: k.difficulty ?? 0,
        intent: this.normalizeIntent(k.intent),
        funnelStage: this.normalizeFunnel(k.funnelStage),
        opportunityScore: k.opportunityScore ?? this.computeOpportunityScore(k.volume ?? 0, k.difficulty ?? 0),
        source: 'method03-content-gap-import',
      }));
  }

  private extractBaseline(context: Record<string, unknown>): BaselineKeyword[] {
    const data = context['phase1-baseline'] as { keywordGaps?: BaselineKeyword[] } | undefined;
    return data?.keywordGaps ?? [];
  }

  // ─── Dedup ───────────────────────────────────────────────────

  private dedup(keywords: NormalizedKeyword[]): NormalizedKeyword[] {
    const map = new Map<string, NormalizedKeyword>();

    for (const kw of keywords) {
      const key = kw.keyword;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, kw);
      } else {
        // Keep the one with higher opportunity score; merge volume if different
        if (kw.opportunityScore > existing.opportunityScore) {
          map.set(key, { ...kw, volume: Math.max(kw.volume, existing.volume) });
        } else {
          // Keep existing but take the higher volume
          if (kw.volume > existing.volume) {
            existing.volume = kw.volume;
          }
        }
      }
    }

    return Array.from(map.values());
  }

  // ─── Enrichment ──────────────────────────────────────────────

  private enrichWithBaseline(keywords: NormalizedKeyword[], baseline: BaselineKeyword[]): void {
    if (baseline.length === 0) return;
    const baselineMap = new Map(baseline.map((b) => [b.keyword?.toLowerCase().trim(), b]));

    for (const kw of keywords) {
      const b = baselineMap.get(kw.keyword);
      if (b) {
        (kw as NormalizedKeyword & { currentPosition?: number }).currentPosition = b.position ?? undefined;
      }
    }
  }

  // ─── Topic Clusters ──────────────────────────────────────────

  private buildTopicClusters(keywords: NormalizedKeyword[]): TopicCluster[] {
    // Group keywords by shared 2-word stems (simple approach)
    const clusters = new Map<string, NormalizedKeyword[]>();

    for (const kw of keywords) {
      const words = kw.keyword.split(/\s+/).filter((w) => w.length > 2);
      // Use the first 2 significant words as the cluster key
      const clusterKey = words.slice(0, 2).join(' ') || kw.keyword;
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(kw);
    }

    // Filter to clusters with 2+ keywords and sort by total volume
    return Array.from(clusters.entries())
      .filter(([, kws]) => kws.length >= 2)
      .map(([topic, kws]) => ({
        topic,
        keywordCount: kws.length,
        totalVolume: kws.reduce((sum, k) => sum + k.volume, 0),
        avgDifficulty: Math.round(kws.reduce((sum, k) => sum + k.difficulty, 0) / kws.length),
        avgOpportunityScore: Math.round((kws.reduce((sum, k) => sum + k.opportunityScore, 0) / kws.length) * 100) / 100,
        topKeywords: kws.sort((a, b) => b.volume - a.volume).slice(0, 5).map((k) => k.keyword),
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 20);
  }

  // ─── Normalization Helpers ───────────────────────────────────

  private normalizeIntent(intent: string | undefined | null): Intent {
    if (!intent) return 'informational';
    const lower = String(intent).toLowerCase().trim();
    if (['informational', 'navigational', 'commercial', 'transactional'].includes(lower)) {
      return lower as Intent;
    }
    return 'informational';
  }

  private normalizeFunnel(funnel: string | undefined | null): FunnelStage {
    if (!funnel) return 'TOFU';
    const upper = String(funnel).toUpperCase().trim();
    if (['TOFU', 'MOFU', 'BOFU'].includes(upper)) return upper as FunnelStage;
    return 'TOFU';
  }

  private intentToFunnel(intent: string | undefined | null): FunnelStage {
    switch (this.normalizeIntent(intent)) {
      case 'transactional': return 'BOFU';
      case 'commercial': return 'MOFU';
      case 'navigational': return 'MOFU';
      default: return 'TOFU';
    }
  }

  private computeOpportunityScore(volume: number, difficulty: number): number {
    // Simple heuristic: high volume + low difficulty = high opportunity
    const volumeScore = Math.min(volume / 10000, 1);
    const difficultyPenalty = Math.min(difficulty / 100, 1);
    return Math.round((volumeScore * (1 - difficultyPenalty * 0.7)) * 100) / 100;
  }

  // ─── Stats Helpers ───────────────────────────────────────────

  private countBySource(keywords: NormalizedKeyword[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const k of keywords) {
      counts[k.source] = (counts[k.source] ?? 0) + 1;
    }
    return counts;
  }

  private countByIntent(keywords: NormalizedKeyword[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const k of keywords) {
      counts[k.intent] = (counts[k.intent] ?? 0) + 1;
    }
    return counts;
  }

  private countByFunnel(keywords: NormalizedKeyword[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const k of keywords) {
      counts[k.funnelStage] = (counts[k.funnelStage] ?? 0) + 1;
    }
    return counts;
  }
}

// ─── Types ─────────────────────────────────────────────────────

type Intent = 'informational' | 'navigational' | 'commercial' | 'transactional';
type FunnelStage = 'TOFU' | 'MOFU' | 'BOFU';

interface NormalizedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: Intent;
  funnelStage: FunnelStage;
  opportunityScore: number;
  source: string;
}

interface SeedKeyword {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  intent?: string;
  source?: string;
  category?: string;
  relevanceScore?: number;
}

interface Method01Keyword {
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  funnelStage?: string;
  opportunityScore?: number;
  sourceCompetitor?: string;
}

interface Method02Keyword {
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  funnelStage?: string;
  opportunityScore?: number;
  expansionMethod?: string;
  sourceSeed?: string;
}

interface QuestionKeyword {
  keyword: string;
  volume?: number;
  parentTopic?: string;
  questionType?: string;
}

interface Method03Keyword {
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  funnelStage?: string;
  opportunityScore?: number;
  source?: string;
  isNew?: boolean;
}

interface BaselineKeyword {
  keyword?: string;
  volume?: number;
  position?: number;
  difficulty?: number;
}

interface TopicCluster {
  topic: string;
  keywordCount: number;
  totalVolume: number;
  avgDifficulty: number;
  avgOpportunityScore: number;
  topKeywords: string[];
}
