'use client';

interface CurrentRankings {
  total: number;
  top3: number;
  top10: number;
  top20: number;
  top100: number;
  topKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    difficulty: number;
    url: string;
    intent: string;
  }>;
}

interface QuickWin {
  keyword: string;
  currentPosition: number;
  volume: number;
  difficulty: number;
  url: string;
  estimatedTrafficGain: number;
  action: string;
}

interface CompetitorOverlap {
  competitor: string;
  sharedKeywords: number;
  uniqueToCompetitor: number;
  uniqueToUs: number;
  overlapPercentage: number;
}

interface Phase1BaselineData {
  currentRankings?: CurrentRankings;
  quickWins?: QuickWin[];
  competitorOverlap?: CompetitorOverlap[];
  intentDistribution?: Record<string, { count: number; volume: number; percentage: number }>;
  summary?: {
    totalKeywordUniverse: number;
    currentVisibility: number;
    estimatedTraffic: number;
    quickWinPotential: number;
    gapOpportunity: number;
  };
  [key: string]: unknown;
}

export function Phase1BaselineRenderer({ data }: { data: unknown }) {
  const baseline = data as Phase1BaselineData;

  if (!baseline || typeof baseline !== 'object') {
    return <p className="text-sm text-zinc-500">No baseline data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Ranking Distribution */}
      {baseline.currentRankings && (
        <div>
          <SectionLabel>Current Ranking Distribution</SectionLabel>
          <div className="mt-2 grid grid-cols-5 gap-2">
            <RankBucket label="Top 3" count={baseline.currentRankings.top3} color="text-emerald-400" />
            <RankBucket label="Top 10" count={baseline.currentRankings.top10} color="text-green-400" />
            <RankBucket label="Top 20" count={baseline.currentRankings.top20} color="text-yellow-400" />
            <RankBucket label="Top 100" count={baseline.currentRankings.top100} color="text-orange-400" />
            <RankBucket label="Total" count={baseline.currentRankings.total} color="text-zinc-300" />
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      {baseline.summary && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Keyword Universe" value={formatNumber(baseline.summary.totalKeywordUniverse)} />
          <MetricCard label="Est. Traffic" value={formatNumber(baseline.summary.estimatedTraffic)} />
          <MetricCard label="Quick Win Potential" value={formatNumber(baseline.summary.quickWinPotential)} />
        </div>
      )}

      {/* Quick Wins */}
      {baseline.quickWins && baseline.quickWins.length > 0 && (
        <div>
          <SectionLabel>Quick Wins ({baseline.quickWins.length})</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Keyword</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Pos</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Volume</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">KD</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Traffic Gain</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {baseline.quickWins.slice(0, 15).map((qw, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-200">{qw.keyword}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{qw.currentPosition}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(qw.volume)}</td>
                    <td className="px-3 py-2 text-right">
                      <DifficultyBadge value={qw.difficulty} />
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-400">+{formatNumber(qw.estimatedTrafficGain)}</td>
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

      {/* Intent Distribution */}
      {baseline.intentDistribution && (
        <div>
          <SectionLabel>Intent Distribution</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Object.entries(baseline.intentDistribution).map(([intent, data]) => (
              <div key={intent} className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-500">{intent}</p>
                <p className="text-sm font-semibold text-zinc-100">{data.percentage}%</p>
                <p className="text-[10px] text-zinc-500">{formatNumber(data.volume)} vol</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Overlap */}
      {baseline.competitorOverlap && baseline.competitorOverlap.length > 0 && (
        <div>
          <SectionLabel>Competitor Overlap</SectionLabel>
          <div className="mt-2 space-y-2">
            {baseline.competitorOverlap.map((co, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <span className="text-sm text-zinc-200">{co.competitor}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-400">{co.sharedKeywords} shared</span>
                  <span className="text-red-400">+{co.uniqueToCompetitor} gaps</span>
                  <span className="text-emerald-400">+{co.uniqueToUs} unique</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{co.overlapPercentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RankBucket({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{formatNumber(count)}</p>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-zinc-100">{value}</p>
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
