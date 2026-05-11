'use client';

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
  const m01 = data as Method01Data;

  if (!m01 || typeof m01 !== 'object') {
    return <p className="text-sm text-zinc-500">No competitor page data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {m01.summary && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Keywords Found" value={m01.summary.totalDiscovered} />
          <StatCard label="Total Volume" value={m01.summary.totalVolume} format />
          <StatCard label="Avg Difficulty" value={m01.summary.avgDifficulty} />
          <StatCard label="Pages Analyzed" value={m01.summary.pagesAnalyzed} />
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
        <div>
          <SectionLabel>Top Discovered Keywords</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Keyword</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Volume</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">KD</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Intent</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Source</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Score</th>
                </tr>
              </thead>
              <tbody>
                {m01.discoveredKeywords.slice(0, 20).map((kw, i) => (
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
      )}
    </div>
  );
}

function StatCard({ label, value, format }: { label: string; value: number; format?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <p className="text-[10px] uppercase text-zinc-500">{label}</p>
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
