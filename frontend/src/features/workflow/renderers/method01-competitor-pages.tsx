'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

interface DiscoveredKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
  funnelStage: string;
  sourceCompetitor: string;
  opportunityScore: number;
  parentTopic?: string | null;
}

interface TopicCluster {
  topic: string;
  keywordCount: number;
  totalVolume: number;
  avgDifficulty: number;
  topKeywords: string[];
  competitorCoverage?: number;
}

interface ContentPattern {
  pattern: string;
  competitors: string[];
  associatedVolume: number;
  recommendation: string;
}

interface Method01Data {
  discoveredKeywords?: DiscoveredKeyword[];
  topicClusters?: TopicCluster[];
  contentPatterns?: ContentPattern[];
  summary?: {
    totalDiscovered: number;
    totalVolume: number;
    avgDifficulty: number;
    competitorsAnalyzed: number;
    pagesAnalyzed: number;
  };
  [key: string]: unknown;
}

export function Method01Renderer({ data }: { data: unknown }) {
  // Agent may return a plain string explanation when no pages were found
  if (typeof data === 'string') {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-sm leading-relaxed text-zinc-400">{data}</p>
      </div>
    );
  }

  const m01 = data as Method01Data;

  if (!m01 || typeof m01 !== 'object') {
    return <p className="text-sm text-zinc-500">No competitor page data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {m01.summary && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Keywords Found" value={m01.summary.totalDiscovered} tip="Total new keywords discovered from competitors" />
          <StatCard label="Total Volume" value={m01.summary.totalVolume} format tip="Sum of monthly searches for discovered keywords" />
          <StatCard label="Avg Difficulty" value={m01.summary.avgDifficulty} tip="Average keyword difficulty of discovered set" />
          <StatCard label="Pages Analyzed" value={m01.summary.pagesAnalyzed} tip="Number of competitor pages analyzed" />
        </div>
      )}

      {/* Topic Clusters */}
      {m01.topicClusters && m01.topicClusters.length > 0 && (
        <div>
          <SectionLabel>Topic Clusters ({m01.topicClusters.length})</SectionLabel>
          <div className="mt-2 space-y-2">
            {m01.topicClusters.slice(0, 10).map((cluster, i) => (
              <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">{cluster.topic}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-400">{cluster.keywordCount} kws</span>
                    <span className="text-zinc-400">{formatNumber(cluster.totalVolume)} vol</span>
                    <DifficultyBadge value={cluster.avgDifficulty} />
                  </div>
                </div>
                {cluster.topKeywords && cluster.topKeywords.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {cluster.topKeywords.slice(0, 5).map((kw, j) => (
                      <span key={j} className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Patterns */}
      {m01.contentPatterns && m01.contentPatterns.length > 0 && (
        <div>
          <SectionLabel>Content Patterns</SectionLabel>
          <div className="mt-2 space-y-2">
            {m01.contentPatterns.map((pattern, i) => (
              <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">{pattern.pattern}</span>
                  <span className="text-xs text-zinc-400">{formatNumber(pattern.associatedVolume)} vol</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">{pattern.recommendation}</p>
                <div className="mt-1 flex gap-1">
                  {pattern.competitors.map((c, j) => (
                    <span key={j} className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Keywords Table */}
      {m01.discoveredKeywords && m01.discoveredKeywords.length > 0 && (
        <SortableDiscoveredKeywordsTable keywords={m01.discoveredKeywords} />
      )}
    </div>
  );
}

function SortableDiscoveredKeywordsTable({ keywords }: { keywords: DiscoveredKeyword[] }) {
  type SK = 'keyword' | 'volume' | 'difficulty' | 'intent' | 'sourceCompetitor' | 'opportunityScore';
  const [sortKey, setSortKey] = useState<SK>('opportunityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'keyword' || key === 'intent' || key === 'sourceCompetitor' ? 'asc' : 'desc'); }
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
      <SectionLabel>Top Discovered Keywords</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('keyword')}><InfoTip tip="Discovered keyword term">Keyword{arrow('keyword')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('volume')}><InfoTip tip="Monthly search volume">Volume{arrow('volume')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('difficulty')}><InfoTip tip="Keyword Difficulty (0–100)">KD{arrow('difficulty')}</InfoTip></th>
              <th className={th('text-left')} onClick={() => handleSort('intent')}><InfoTip tip="Search intent type">Intent{arrow('intent')}</InfoTip></th>
              <th className={th('text-left')} onClick={() => handleSort('sourceCompetitor')}><InfoTip tip="Competitor domain it came from">Source{arrow('sourceCompetitor')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('opportunityScore')}><InfoTip tip="Opportunity score (0–100%)">Score{arrow('opportunityScore')}</InfoTip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 20).map((kw, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-200">{kw.keyword}</td>
                <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(kw.volume)}</td>
                <td className="px-3 py-2 text-right"><DifficultyBadge value={kw.difficulty} /></td>
                <td className="px-3 py-2"><IntentBadge intent={kw.intent} /></td>
                <td className="px-3 py-2 text-[11px] text-zinc-500">{kw.sourceCompetitor}</td>
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

function StatCard({ label, value, format, tip }: { label: string; value: number; format?: boolean; tip?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <p className="text-[10px] uppercase text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
      <p className="mt-1 text-lg font-bold text-zinc-100">{format ? formatNumber(value) : value}</p>
    </div>
  );
}

function DifficultyBadge({ value }: { value: number }) {
  const color = value <= 30 ? 'text-green-400' : value <= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{value}</span>;
}

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    informational: 'bg-blue-500/10 text-blue-400',
    commercial: 'bg-amber-500/10 text-amber-400',
    transactional: 'bg-emerald-500/10 text-emerald-400',
    navigational: 'bg-zinc-500/10 text-zinc-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${colors[intent] ?? colors.informational}`}>
      {intent}
    </span>
  );
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
