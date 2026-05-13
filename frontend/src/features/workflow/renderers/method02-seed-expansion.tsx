'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

interface ExpandedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
  funnelStage: string;
  expansionMethod: string;
  sourceSeed: string;
  opportunityScore: number;
}

interface TopicCluster {
  topic: string;
  keywordCount: number;
  totalVolume: number;
  avgDifficulty: number;
  intentMix?: Record<string, number>;
  topKeywords: string[];
}

interface QuestionKeyword {
  keyword: string;
  volume: number;
  questionType: string;
  parentTopic: string;
}

interface Method02Data {
  expandedKeywords?: ExpandedKeyword[];
  expansionByMethod?: Record<string, { count: number; totalVolume: number; avgDifficulty: number }>;
  topicClusters?: TopicCluster[];
  questionKeywords?: QuestionKeyword[];
  summary?: {
    totalExpanded: number;
    newUniqueKeywords: number;
    totalVolume: number;
    avgDifficulty: number;
    topExpansionMethod: string;
    seedsUsed: number;
  };
  [key: string]: unknown;
}

/**
 * Normalize agent output: expandedKeywords may be a nested
 * Record<category, Record<subcategory, string[]>> instead of ExpandedKeyword[].
 */
function normalizeMethod02(raw: Record<string, unknown>): Method02Data {
  const result = { ...raw } as Method02Data;

  // If expandedKeywords is a plain object (not array), flatten it
  if (
    result.expandedKeywords &&
    !Array.isArray(result.expandedKeywords) &&
    typeof result.expandedKeywords === 'object'
  ) {
    const flat: ExpandedKeyword[] = [];
    const catObj = result.expandedKeywords as Record<string, Record<string, string[]>>;
    for (const [category, subcats] of Object.entries(catObj)) {
      if (typeof subcats !== 'object' || subcats === null) continue;
      for (const [seedKeyword, keywords] of Object.entries(subcats)) {
        if (!Array.isArray(keywords)) continue;
        for (const kw of keywords) {
          flat.push({
            keyword: String(kw),
            volume: 0,
            difficulty: 0,
            intent: '',
            funnelStage: category,
            expansionMethod: 'seed-expansion',
            sourceSeed: seedKeyword,
            opportunityScore: 0,
          });
        }
      }
    }
    result.expandedKeywords = flat;
  }

  return result;
}

export function Method02Renderer({ data }: { data: unknown }) {
  const m02 = data && typeof data === 'object' ? normalizeMethod02(data as Record<string, unknown>) : (data as Method02Data);

  if (!m02 || typeof m02 !== 'object') {
    return <p className="text-sm text-zinc-500">No seed expansion data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {m02.summary && (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Total Expanded" value={formatNumber(m02.summary.totalExpanded)} tip="Total keywords added via seed expansion" />
          <MetricCard label="New Unique" value={formatNumber(m02.summary.newUniqueKeywords)} tip="Keywords not in prior lists (deduped)" />
          <MetricCard label="Total Volume" value={formatNumber(m02.summary.totalVolume)} tip="Sum of monthly searches for expanded set" />
          <MetricCard label="Top Method" value={m02.summary.topExpansionMethod} tip="Most effective expansion technique used" />
        </div>
      )}

      {/* Expansion by Method */}
      {m02.expansionByMethod && (
        <div>
          <SectionLabel>Expansion Methods</SectionLabel>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {Object.entries(m02.expansionByMethod).map(([method, stats]) => (
              <div key={method} className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-500">{method}</p>
                <p className="text-sm font-semibold text-zinc-100">{stats.count}</p>
                <p className="text-[10px] text-zinc-500">{formatNumber(stats.totalVolume)} vol</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question Keywords */}
      {m02.questionKeywords && m02.questionKeywords.length > 0 && (
        <div>
          <SectionLabel>Question Keywords ({m02.questionKeywords.length})</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {m02.questionKeywords.slice(0, 20).map((q, i) => (
              <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5">
                <span className="text-[11px] text-zinc-300">{q.keyword}</span>
                {q.volume > 0 && (
                  <span className="ml-2 text-[10px] text-zinc-500">{formatNumber(q.volume)}</span>
                )}
              </div>
            ))}
            {m02.questionKeywords.length > 20 && (
              <span className="self-center text-[10px] text-zinc-500">
                +{m02.questionKeywords.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Topic Clusters */}
      {m02.topicClusters && m02.topicClusters.length > 0 && (
        <SortableTopicClustersTable clusters={m02.topicClusters} />
      )}

      {/* Top Keywords */}
      {m02.expandedKeywords && m02.expandedKeywords.length > 0 && (
        <SortableExpandedKeywordsTable keywords={m02.expandedKeywords} />
      )}
    </div>
  );
}

function SortableTopicClustersTable({ clusters }: { clusters: TopicCluster[] }) {
  type SK = 'topic' | 'keywordCount' | 'totalVolume' | 'avgDifficulty';
  const [sortKey, setSortKey] = useState<SK>('totalVolume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'topic' ? 'asc' : 'desc'); }
  };

  const sorted = [...clusters].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (align: string) => `cursor-pointer select-none px-3 py-2 text-[10px] uppercase text-zinc-500 hover:text-zinc-300 ${align}`;

  return (
    <div>
      <SectionLabel>Topic Clusters ({clusters.length})</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('topic')}><InfoTip tip="Cluster subject">Topic{arrow('topic')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('keywordCount')}><InfoTip tip="Count of keywords in topic">Keywords{arrow('keywordCount')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('totalVolume')}><InfoTip tip="Total monthly searches">Volume{arrow('totalVolume')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('avgDifficulty')}><InfoTip tip="Average difficulty for cluster">Avg KD{arrow('avgDifficulty')}</InfoTip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 15).map((cluster, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2">
                  <span className="text-zinc-200">{cluster.topic}</span>
                  {cluster.topKeywords && cluster.topKeywords.length > 0 && (
                    <div className="mt-0.5 flex gap-1">
                      {cluster.topKeywords.slice(0, 3).map((kw, j) => (
                        <span key={j} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">{kw}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-zinc-400">{cluster.keywordCount}</td>
                <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(cluster.totalVolume)}</td>
                <td className="px-3 py-2 text-right"><DifficultyBadge value={cluster.avgDifficulty} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableExpandedKeywordsTable({ keywords }: { keywords: ExpandedKeyword[] }) {
  type SK = 'keyword' | 'volume' | 'difficulty' | 'expansionMethod' | 'opportunityScore';
  const [sortKey, setSortKey] = useState<SK>('opportunityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'keyword' || key === 'expansionMethod' ? 'asc' : 'desc'); }
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
      <SectionLabel>Top Expanded Keywords</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('keyword')}><InfoTip tip="Expanded keyword term">Keyword{arrow('keyword')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('volume')}><InfoTip tip="Monthly search volume">Volume{arrow('volume')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('difficulty')}><InfoTip tip="Keyword Difficulty (0–100)">KD{arrow('difficulty')}</InfoTip></th>
              <th className={th('text-left')} onClick={() => handleSort('expansionMethod')}><InfoTip tip="Expansion technique (synonym, LSI, etc.)">Method{arrow('expansionMethod')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('opportunityScore')}><InfoTip tip="Opportunity score (0–100%)">Score{arrow('opportunityScore')}</InfoTip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 15).map((kw, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-200">{kw.keyword}</td>
                <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(kw.volume)}</td>
                <td className="px-3 py-2 text-right"><DifficultyBadge value={kw.difficulty} /></td>
                <td className="px-3 py-2">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{kw.expansionMethod}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                    {(kw.opportunityScore * 100).toFixed(0)}%
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

function MetricCard({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
      <p className="mt-1 text-lg font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function DifficultyBadge({ value }: { value: number }) {
  const color = value <= 30 ? 'text-green-400' : value <= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{value}</span>;
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
