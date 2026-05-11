'use client';

interface ConsolidatedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
  funnelStage: string;
  opportunityScore: number;
  currentPosition?: number | null;
  source: string;
  isQuickWin: boolean;
}

interface Cluster {
  name: string;
  keywordCount: number;
  totalVolume: number;
  avgDifficulty: number;
  avgOpportunity: number;
  primaryIntent: string;
  funnelStage: string;
  priority: string;
  topKeywords: string[];
}

interface ConsolidatedData {
  keywords?: ConsolidatedKeyword[];
  clusters?: Cluster[];
  quickWins?: Array<{
    keyword: string;
    currentPosition: number;
    volume: number;
    difficulty: number;
    url: string;
    estimatedTrafficGain: number;
    action: string;
  }>;
  stats?: {
    totalKeywords: number;
    afterDedup: number;
    bySource: Record<string, number>;
    byIntent: Record<string, number>;
    byFunnel: Record<string, number>;
    totalVolume: number;
    avgDifficulty: number;
    quickWinCount: number;
    highPriorityClusters: number;
  };
  summary?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

export function ConsolidatedKeywordsRenderer({ data }: { data: unknown }) {
  const kw = data as ConsolidatedData;

  if (!kw || typeof kw !== 'object') {
    return <p className="text-sm text-zinc-500">No consolidated keyword data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {kw.stats && (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Total Keywords" value={formatNumber(kw.stats.afterDedup)} />
          <MetricCard label="Total Volume" value={formatNumber(kw.stats.totalVolume)} />
          <MetricCard label="Avg Difficulty" value={String(kw.stats.avgDifficulty)} />
          <MetricCard label="Quick Wins" value={String(kw.stats.quickWinCount)} />
        </div>
      )}

      {/* Source Breakdown */}
      {kw.stats?.bySource && (
        <div>
          <SectionLabel>By Source</SectionLabel>
          <div className="mt-2 flex gap-2">
            {Object.entries(kw.stats.bySource).map(([source, count]) => (
              <div key={source} className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-center">
                <p className="text-sm font-semibold text-zinc-100">{count}</p>
                <p className="text-[9px] uppercase text-zinc-500">{source}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Funnel Distribution */}
      {kw.stats?.byFunnel && (
        <div>
          <SectionLabel>Funnel Distribution</SectionLabel>
          <div className="mt-2 flex gap-3">
            {Object.entries(kw.stats.byFunnel).map(([stage, count]) => {
              const colors: Record<string, string> = { tofu: 'bg-blue-500', mofu: 'bg-amber-500', bofu: 'bg-emerald-500' };
              const total = Object.values(kw.stats!.byFunnel).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
              return (
                <div key={stage} className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-zinc-500">{stage}</span>
                    <span className="text-[10px] text-zinc-400">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-zinc-800">
                    <div className={`h-2 rounded-full ${colors[stage] ?? 'bg-zinc-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Priority Clusters */}
      {kw.clusters && kw.clusters.length > 0 && (
        <div>
          <SectionLabel>Priority Clusters</SectionLabel>
          <div className="mt-2 space-y-2">
            {kw.clusters
              .filter(c => c.priority === 'high')
              .slice(0, 8)
              .map((cluster, i) => (
                <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{cluster.name}</span>
                      <PriorityBadge priority={cluster.priority} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>{cluster.keywordCount} kws</span>
                      <span>{formatNumber(cluster.totalVolume)} vol</span>
                      <DifficultyBadge value={cluster.avgDifficulty} />
                    </div>
                  </div>
                  {cluster.topKeywords.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {cluster.topKeywords.slice(0, 5).map((k, j) => (
                        <span key={j} className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{k}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick Wins */}
      {kw.quickWins && kw.quickWins.length > 0 && (
        <div>
          <SectionLabel>Quick Wins ({kw.quickWins.length})</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Keyword</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Pos</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Volume</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">KD</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {kw.quickWins.slice(0, 10).map((qw, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-200">{qw.keyword}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{qw.currentPosition}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(qw.volume)}</td>
                    <td className="px-3 py-2 text-right"><DifficultyBadge value={qw.difficulty} /></td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{qw.action}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {kw.recommendations && kw.recommendations.length > 0 && (
        <div>
          <SectionLabel>Recommendations</SectionLabel>
          <ul className="mt-2 space-y-1">
            {kw.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                <span className="mt-0.5 text-emerald-500">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {kw.summary && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
          <p className="text-sm leading-relaxed text-zinc-300">{kw.summary}</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-zinc-500/10 text-zinc-400',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${colors[priority] ?? colors.low}`}>{priority}</span>;
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
