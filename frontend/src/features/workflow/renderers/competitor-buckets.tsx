'use client';

interface CompetitorBucket {
  name: string;
  type: string;
  competitors: Array<{
    domain: string;
    overlapScore?: number;
    relevance?: string;
  }>;
}

interface CompetitorBucketsData {
  buckets?: CompetitorBucket[];
  totalCompetitors?: number;
  summary?: {
    directCompetitors: number;
    indirectCompetitors: number;
    aspirational: number;
    recommendation: string;
  };
  [key: string]: unknown;
}

export function CompetitorBucketsRenderer({ data }: { data: unknown }) {
  const buckets = data as CompetitorBucketsData;

  if (!buckets || typeof buckets !== 'object') {
    return <p className="text-sm text-zinc-500">No competitor bucket data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {buckets.summary && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Direct" value={String(buckets.summary.directCompetitors)} color="text-red-400" />
          <MetricCard label="Indirect" value={String(buckets.summary.indirectCompetitors)} color="text-amber-400" />
          <MetricCard label="Aspirational" value={String(buckets.summary.aspirational)} color="text-violet-400" />
        </div>
      )}

      {/* Buckets */}
      {buckets.buckets && buckets.buckets.length > 0 && (
        <div className="space-y-3">
          {buckets.buckets.map((bucket, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">{bucket.name}</span>
                <BucketTypeBadge type={bucket.type} />
              </div>
              <div className="mt-2 space-y-1.5">
                {bucket.competitors.map((comp, j) => (
                  <div key={j} className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-1.5">
                    <span className="text-[11px] text-zinc-300">{comp.domain}</span>
                    <div className="flex items-center gap-2">
                      {comp.overlapScore !== undefined && (
                        <span className="text-[10px] text-zinc-500">{(comp.overlapScore * 100).toFixed(0)}% overlap</span>
                      )}
                      {comp.relevance && (
                        <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400">{comp.relevance}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      {buckets.summary?.recommendation && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
          <p className="text-[11px] text-zinc-400">{buckets.summary.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function BucketTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    direct: 'bg-red-500/10 text-red-400',
    indirect: 'bg-amber-500/10 text-amber-400',
    aspirational: 'bg-violet-500/10 text-violet-400',
    niche: 'bg-blue-500/10 text-blue-400',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${colors[type] ?? colors.niche}`}>{type}</span>;
}
