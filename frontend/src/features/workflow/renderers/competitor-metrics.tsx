'use client';

interface CompetitorMetric {
  domain: string;
  domainRating: number;
  organicKeywords: number;
  organicTraffic: number;
  backlinks: number;
  referringDomains: number;
  topPages?: Array<{ url: string; traffic: number }>;
}

interface CompetitorMetricsData {
  competitors?: CompetitorMetric[];
  ourMetrics?: CompetitorMetric;
  gaps?: Array<{
    metric: string;
    ourValue: number;
    avgCompetitor: number;
    gap: number;
    priority: string;
  }>;
  summary?: {
    strongestCompetitor: string;
    weakestArea: string;
    recommendation: string;
  };
  [key: string]: unknown;
}

export function CompetitorMetricsRenderer({ data }: { data: unknown }) {
  const metrics = data as CompetitorMetricsData;

  if (!metrics || typeof metrics !== 'object') {
    return <p className="text-sm text-zinc-500">No competitor metrics data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Competitor Comparison Table */}
      {metrics.competitors && metrics.competitors.length > 0 && (
        <div>
          <SectionLabel>Competitor Comparison</SectionLabel>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500">Domain</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">DR</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Keywords</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Traffic</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Backlinks</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase text-zinc-500">Ref. Domains</th>
                </tr>
              </thead>
              <tbody>
                {/* Our domain first (highlighted) */}
                {metrics.ourMetrics && (
                  <tr className="border-b border-zinc-800/50 bg-emerald-500/5">
                    <td className="px-3 py-2 font-medium text-emerald-400">{metrics.ourMetrics.domain} (you)</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{metrics.ourMetrics.domainRating}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(metrics.ourMetrics.organicKeywords)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(metrics.ourMetrics.organicTraffic)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(metrics.ourMetrics.backlinks)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(metrics.ourMetrics.referringDomains)}</td>
                  </tr>
                )}
                {metrics.competitors.map((comp, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-200">{comp.domain}</td>
                    <td className="px-3 py-2 text-right"><DRBadge value={comp.domainRating} /></td>
                    <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(comp.organicKeywords)}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(comp.organicTraffic)}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(comp.backlinks)}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(comp.referringDomains)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gaps Analysis */}
      {metrics.gaps && metrics.gaps.length > 0 && (
        <div>
          <SectionLabel>Metric Gaps</SectionLabel>
          <div className="mt-2 space-y-2">
            {metrics.gaps.map((gap, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <PriorityDot priority={gap.priority} />
                  <span className="text-sm text-zinc-200">{gap.metric}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-500">You: {formatNumber(gap.ourValue)}</span>
                  <span className="text-zinc-500">Avg: {formatNumber(gap.avgCompetitor)}</span>
                  <span className={gap.gap > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {gap.gap > 0 ? '-' : '+'}{formatNumber(Math.abs(gap.gap))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {metrics.summary && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="flex gap-4 text-[11px]">
            <span className="text-zinc-500">Strongest competitor: <span className="text-zinc-300">{metrics.summary.strongestCompetitor}</span></span>
            <span className="text-zinc-500">Weakest area: <span className="text-red-400">{metrics.summary.weakestArea}</span></span>
          </div>
          {metrics.summary.recommendation && (
            <p className="mt-1.5 text-[11px] text-zinc-400">{metrics.summary.recommendation}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DRBadge({ value }: { value: number }) {
  const color = value >= 60 ? 'text-emerald-400' : value >= 30 ? 'text-amber-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{value}</span>;
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-zinc-500' };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[priority] ?? colors.low}`} />;
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
