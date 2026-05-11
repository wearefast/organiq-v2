'use client';

interface SerpEntry {
  keyword: string;
  volume?: number;
  difficulty?: number;
  serpType?: string;
  topDomains?: string[];
  features?: string[];
}

interface NicheSegment {
  name: string;
  keywords: string[];
  totalVolume: number;
  dominantPlayers: string[];
  opportunity: string;
}

interface SerpNicheMapData {
  serpEntries?: SerpEntry[];
  nicheSegments?: NicheSegment[];
  dominantDomains?: Array<{
    domain: string;
    keywordsRanking: number;
    avgPosition: number;
    visibility: number;
  }>;
  summary?: {
    totalKeywordsAnalyzed: number;
    nichesIdentified: number;
    avgDifficulty: number;
    topOpportunity: string;
  };
  [key: string]: unknown;
}

export function SerpNicheMapRenderer({ data }: { data: unknown }) {
  const niche = data as SerpNicheMapData;

  if (!niche || typeof niche !== 'object') {
    return <p className="text-sm text-zinc-500">No SERP niche map data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {niche.summary && (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Keywords Analyzed" value={String(niche.summary.totalKeywordsAnalyzed)} />
          <MetricCard label="Niches Found" value={String(niche.summary.nichesIdentified)} />
          <MetricCard label="Avg Difficulty" value={String(niche.summary.avgDifficulty)} />
          <MetricCard label="Top Opportunity" value={niche.summary.topOpportunity} />
        </div>
      )}

      {/* Niche Segments */}
      {niche.nicheSegments && niche.nicheSegments.length > 0 && (
        <div>
          <SectionLabel>Niche Segments ({niche.nicheSegments.length})</SectionLabel>
          <div className="mt-2 space-y-2">
            {niche.nicheSegments.map((seg, i) => (
              <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">{seg.name}</span>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span>{seg.keywords.length} kws</span>
                    <span>{formatNumber(seg.totalVolume)} vol</span>
                    <OpportunityBadge level={seg.opportunity} />
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {seg.dominantPlayers.slice(0, 4).map((d, j) => (
                    <span key={j} className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dominant Domains */}
      {niche.dominantDomains && niche.dominantDomains.length > 0 && (
        <div>
          <SectionLabel>Dominant Domains</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Domain</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Keywords</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Avg Pos</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Visibility</th>
                </tr>
              </thead>
              <tbody>
                {niche.dominantDomains.slice(0, 10).map((d, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-200">{d.domain}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{d.keywordsRanking}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{d.avgPosition.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                        {(d.visibility * 100).toFixed(0)}%
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function OpportunityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: 'bg-emerald-500/10 text-emerald-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-zinc-500/10 text-zinc-400',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${colors[level] ?? colors.medium}`}>{level}</span>;
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
