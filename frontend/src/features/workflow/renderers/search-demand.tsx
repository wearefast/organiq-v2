'use client';

interface SearchDemandData {
  enrichedKeywords?: Array<{
    keyword: string;
    category: string;
    intent: string;
    metrics: {
      searchVolume: number;
      keywordDifficulty: number;
      cpc?: number;
      competition?: string;
      trend?: string;
    };
    opportunityScore: number;
  }>;
  demandByCategory?: Array<{
    category: string;
    totalVolume: number;
    avgDifficulty: number;
    keywordCount: number;
    topKeyword: string;
  }>;
  demandByIntent?: Record<string, { volume: number; count: number; avgDifficulty: number }>;
  highOpportunity?: Array<{
    keyword: string;
    volume: number;
    difficulty: number;
    opportunityScore: number;
    rationale: string;
  }>;
  totalAddressableVolume?: number;
  realisticTargetVolume?: number;
  summary?: string;
  [key: string]: unknown;
}

export function SearchDemandRenderer({ data }: { data: unknown }) {
  const demand = data as SearchDemandData;

  if (!demand || typeof demand !== 'object') {
    return <p className="text-sm text-zinc-500">No search demand data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Volume Headlines */}
      {(demand.totalAddressableVolume !== undefined || demand.realisticTargetVolume !== undefined) && (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Total Addressable Volume"
            value={formatNumber(demand.totalAddressableVolume)}
            subtitle="Monthly searches"
          />
          <MetricCard
            label="Realistic Target Volume"
            value={formatNumber(demand.realisticTargetVolume)}
            subtitle="Achievable traffic"
          />
        </div>
      )}

      {/* Demand by Intent */}
      {demand.demandByIntent && (
        <div>
          <SectionLabel>Demand by Intent</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Object.entries(demand.demandByIntent).map(([intent, data]) => (
              <div key={intent} className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-500">{intent}</p>
                <p className="text-sm font-semibold text-zinc-100">{formatNumber(data.volume)}</p>
                <p className="text-[10px] text-zinc-500">{data.count} keywords</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demand by Category */}
      {demand.demandByCategory && demand.demandByCategory.length > 0 && (
        <div>
          <SectionLabel>Demand by Category</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Category</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Volume</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Avg KD</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Keywords</th>
                </tr>
              </thead>
              <tbody>
                {demand.demandByCategory.map((cat, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-300">{cat.category}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(cat.totalVolume)}</td>
                    <td className="px-3 py-2 text-right">
                      <DifficultyBadge value={cat.avgDifficulty} />
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400">{cat.keywordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* High Opportunity Keywords */}
      {demand.highOpportunity && demand.highOpportunity.length > 0 && (
        <div>
          <SectionLabel>High Opportunity Keywords</SectionLabel>
          <div className="mt-2 space-y-2">
            {demand.highOpportunity.slice(0, 10).map((kw, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-zinc-200">{kw.keyword}</span>
                  <p className="text-[10px] text-zinc-500">{kw.rationale}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">{formatNumber(kw.volume)} vol</span>
                  <DifficultyBadge value={kw.difficulty} />
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-medium text-violet-400">
                    {(kw.opportunityScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {demand.summary && (
        <div>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{demand.summary}</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-100">{value}</p>
      <p className="text-[10px] text-zinc-500">{subtitle}</p>
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
