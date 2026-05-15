'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

interface ImportedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
  funnelStage: string;
  source: string;
  opportunityScore: number;
  isNew: boolean;
}

interface Method03Data {
  importedKeywords?: ImportedKeyword[];
  importStats?: {
    totalImported: number;
    afterCleaning: number;
    afterDedup: number;
    newUnique: number;
    duplicatesRemoved: number;
    enriched: number;
  };
  bySource?: Array<{
    source: string;
    count: number;
    totalVolume: number;
    avgDifficulty: number;
  }>;
  topicClusters?: Array<{
    topic: string;
    keywordCount: number;
    totalVolume: number;
    avgDifficulty: number;
    topKeywords: string[];
  }>;
  summary?: {
    totalNewKeywords: number;
    totalVolume: number;
    avgDifficulty: number;
    avgOpportunityScore: number;
    topSource: string;
    recommendation: string;
  };
  [key: string]: unknown;
}

/**
 * Normalize agent output: data may have 'keywords' instead of 'importedKeywords',
 * and fields may be snake_case (funnel_stage, opportunity_score).
 */
function normalizeMethod03(raw: Record<string, unknown>): Method03Data {
  const result = { ...raw } as Method03Data;

  // Map 'keywords' → 'importedKeywords' if needed
  const kwSource = (result.importedKeywords ?? (raw as Record<string, unknown>).keywords) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(kwSource) && kwSource.length > 0 && !result.importedKeywords) {
    result.importedKeywords = kwSource.map((kw) => {
      const volume = Number(kw.volume ?? 0);
      const difficulty = Number(kw.difficulty ?? 0);
      const rawScore = Number(kw.opportunityScore ?? kw.opportunity_score ?? 0);
      // If agent returned a 0–1 decimal, compute the raw integer score instead
      const opportunityScore = rawScore > 0 && rawScore <= 1
        ? Math.round(volume * (100 - difficulty) / 100)
        : rawScore;
      return {
        keyword: String(kw.keyword ?? ''),
        volume,
        difficulty,
        intent: String(kw.intent ?? ''),
        funnelStage: String(kw.funnelStage ?? kw.funnel_stage ?? ''),
        source: String(kw.source ?? 'content-gap'),
        opportunityScore,
        isNew: Boolean(kw.isNew ?? kw.is_new ?? true),
      };
    });
  }

  // Also recompute scores on already-mapped importedKeywords when decimal range
  if (Array.isArray(result.importedKeywords)) {
    result.importedKeywords = result.importedKeywords.map((kw) => {
      if (kw.opportunityScore > 0 && kw.opportunityScore <= 1) {
        return { ...kw, opportunityScore: Math.round(kw.volume * (100 - kw.difficulty) / 100) };
      }
      return kw;
    });
  }

  return result;
}

export function Method03Renderer({ data }: { data: unknown }) {
  const m03 = data && typeof data === 'object' ? normalizeMethod03(data as Record<string, unknown>) : (data as Method03Data);

  if (!m03 || typeof m03 !== 'object') {
    return <p className="text-sm text-zinc-500">No content gap import data available.</p>;
  }

  // If no data was imported, show a friendly message
  if (m03.importStats && m03.importStats.totalImported === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
        <p className="text-sm text-zinc-400">No keywords were imported in this step.</p>
        {m03.summary?.recommendation && (
          <p className="mt-2 text-[11px] text-zinc-500">{m03.summary.recommendation}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Import Pipeline Stats */}
      {m03.importStats && (
        <div>
          <SectionLabel>Import Pipeline</SectionLabel>
          <div className="mt-2 flex items-center gap-2">
            <PipelineStep label="Imported" value={m03.importStats.totalImported} tip="Raw keywords imported from analysis" />
            <Arrow />
            <PipelineStep label="Cleaned" value={m03.importStats.afterCleaning} tip="After removing formatting issues" />
            <Arrow />
            <PipelineStep label="Deduped" value={m03.importStats.afterDedup} tip="After removing exact duplicates" />
            <Arrow />
            <PipelineStep label="New Unique" value={m03.importStats.newUnique} active tip="Final count ready for strategy" />
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {m03.importStats.duplicatesRemoved} duplicates removed · {m03.importStats.enriched} enriched with metrics
          </p>
        </div>
      )}

      {/* By Source */}
      {m03.bySource && m03.bySource.length > 0 && (
        <div>
          <SectionLabel>By Source</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {m03.bySource.map((src, i) => (
              <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">{src.source}</span>
                  <span className="text-xs text-zinc-400">{src.count} keywords</span>
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-zinc-500">
                  <span>{formatNumber(src.totalVolume)} total vol</span>
                  <span>Avg KD: <DifficultyBadge value={src.avgDifficulty} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic Clusters */}
      {m03.topicClusters && m03.topicClusters.length > 0 && (
        <div>
          <SectionLabel>Topic Clusters</SectionLabel>
          <div className="mt-2 space-y-2">
            {m03.topicClusters.slice(0, 8).map((cluster, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <div>
                  <span className="text-sm text-zinc-200">{cluster.topic}</span>
                  <div className="mt-0.5 flex gap-1">
                    {cluster.topKeywords.slice(0, 3).map((kw, j) => (
                      <span key={j} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">{kw}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>{cluster.keywordCount} kws</span>
                  <span>{formatNumber(cluster.totalVolume)} vol</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Imported Keywords Table */}
      {m03.importedKeywords && m03.importedKeywords.length > 0 && (
        <SortableImportedKeywordsTable keywords={m03.importedKeywords} />
      )}

      {/* Recommendation */}
      {m03.summary?.recommendation && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
          <p className="text-[11px] text-zinc-400">{m03.summary.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function SortableImportedKeywordsTable({ keywords }: { keywords: ImportedKeyword[] }) {
  type SK = 'keyword' | 'volume' | 'difficulty' | 'source' | 'opportunityScore';
  const [sortKey, setSortKey] = useState<SK>('opportunityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'keyword' || key === 'source' ? 'asc' : 'desc'); }
  };

  const sorted = [...keywords].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (align: string) => `cursor-pointer select-none px-3 py-2 text-[10px] uppercase text-zinc-500 hover:text-zinc-300 ${align}`;

  return (
    <div>
      <SectionLabel>Imported Keywords ({keywords.length})</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('keyword')}><InfoTip tip="Imported keyword term">Keyword{arrow('keyword')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('volume')}><InfoTip tip="Monthly search volume">Volume{arrow('volume')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('difficulty')}><InfoTip tip="Keyword Difficulty (0–100)">KD{arrow('difficulty')}</InfoTip></th>
              <th className={th('text-left')} onClick={() => handleSort('source')}><InfoTip tip="Where this keyword originated">Source{arrow('source')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('opportunityScore')}><InfoTip tip="Opp. Score = volume × (100 − difficulty) / 100. Higher = more traffic potential with less competition.">Opp. Score{arrow('opportunityScore')}</InfoTip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 20).map((kw, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-200">{kw.keyword}</td>
                <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(kw.volume)}</td>
                <td className="px-3 py-2 text-right"><DifficultyBadge value={kw.difficulty} /></td>
                <td className="px-3 py-2">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{kw.source}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                    {Math.round(kw.opportunityScore).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PipelineStep({ label, value, active, tip }: { label: string; value: number; active?: boolean; tip?: string }) {
  return (
    <div className={`rounded border px-3 py-2 text-center ${active ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50'}`}>
      <p className={`text-sm font-bold ${active ? 'text-emerald-400' : 'text-zinc-100'}`}>{formatNumber(value)}</p>
      <p className="text-[9px] uppercase text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
    </div>
  );
}

function Arrow() {
  return <span className="text-zinc-600">→</span>;
}

function DifficultyBadge({ value, showLabel }: { value: number; showLabel?: boolean }) {
  const color = value <= 30 ? 'text-green-400' : value <= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{showLabel ? 'KD: ' : ''}{Math.round(value)}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
