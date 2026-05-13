'use client';

interface Competitor {
  domain?: string;
  name?: string;
  positioning?: string;
  evidence?: string;
  keywordOverlap?: string;
  threatLevel?: string | number;
  strengths?: string[];
  weaknesses?: string[];
  overlapScore?: number;
  relevance?: string;
}

interface CompetitorBucketsData {
  buckets?: Record<string, Competitor[] | { description?: string; competitors?: Competitor[] }> | Array<{ name: string; type: string; competitors: Competitor[] }>;
  totalCompetitors?: number;
  topThreats?: string[];
  contentGapDomains?: string[];
  summary?: string | { directCompetitors: number; indirectCompetitors: number; aspirational: number; recommendation: string };
  [key: string]: unknown;
}

/** Normalize buckets from either object-keyed or array format into a flat array */
function normalizeBuckets(raw: CompetitorBucketsData['buckets']): Array<{ name: string; type: string; competitors: Competitor[] }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Object keyed by bucket type e.g. { direct: [...], indirect: [...] }
  return Object.entries(raw).map(([type, val]) => {
    const competitors = Array.isArray(val) ? val : (val as { competitors?: Competitor[] }).competitors ?? [];
    return { name: type.charAt(0).toUpperCase() + type.slice(1), type, competitors };
  });
}

const BUCKET_LABELS: Record<string, string> = { direct: 'Direct', indirect: 'Indirect', content: 'Content', aspirational: 'Aspirational' };

export function CompetitorBucketsRenderer({ data }: { data: unknown }) {
  const raw = data as CompetitorBucketsData;

  if (!raw || typeof raw !== 'object') {
    return <p className="text-sm text-zinc-500">No competitor bucket data available.</p>;
  }

  const bucketList = normalizeBuckets(raw.buckets);
  const totalCompetitors = raw.totalCompetitors ?? bucketList.reduce((sum, b) => sum + b.competitors.length, 0);

  // Summary can be string or structured object
  const summaryStr = typeof raw.summary === 'string' ? raw.summary : null;
  const summaryObj = typeof raw.summary === 'object' && raw.summary ? raw.summary : null;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total" value={String(totalCompetitors)} color="text-zinc-200" />
        {summaryObj ? (
          <>
            <MetricCard label="Direct" value={String(summaryObj.directCompetitors)} color="text-red-400" />
            <MetricCard label="Indirect" value={String(summaryObj.indirectCompetitors)} color="text-amber-400" />
            <MetricCard label="Aspirational" value={String(summaryObj.aspirational)} color="text-violet-400" />
          </>
        ) : (
          bucketList.map((b) => (
            <MetricCard key={b.type} label={BUCKET_LABELS[b.type] ?? b.name} value={String(b.competitors.length)} color={BUCKET_COLORS[b.type] ?? 'text-zinc-300'} />
          ))
        )}
      </div>

      {/* Summary text */}
      {summaryStr && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
          <p className="text-[11px] text-zinc-400">{summaryStr}</p>
        </div>
      )}

      {/* Buckets */}
      {bucketList.length > 0 && (
        <div className="space-y-3">
          {bucketList.map((bucket, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center gap-2">
                <BucketTypeBadge type={bucket.type} />
                <span className="text-[10px] text-zinc-500">{bucket.competitors.length} competitor{bucket.competitors.length !== 1 ? 's' : ''}</span>
              </div>
              {bucket.competitors.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {bucket.competitors.map((comp, j) => (
                    <div key={j} className="rounded bg-zinc-800/50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {comp.domain && <span className="text-[11px] text-zinc-300">{comp.domain}</span>}
                          {comp.name && comp.name !== comp.domain && (
                            <span className="text-[11px] text-zinc-300">
                              {comp.domain ? `(${comp.name})` : comp.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {comp.keywordOverlap && (
                            <span className="text-[10px] text-zinc-500">{comp.keywordOverlap} overlap</span>
                          )}
                          {comp.threatLevel !== undefined && (
                            <ThreatBadge level={comp.threatLevel} />
                          )}
                          {comp.overlapScore !== undefined && (
                            <span className="text-[10px] text-zinc-500">{(comp.overlapScore * 100).toFixed(0)}% overlap</span>
                          )}
                          {comp.relevance && (
                            <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400">{comp.relevance}</span>
                          )}
                        </div>
                      </div>
                      {(comp.positioning || comp.evidence) && (
                        <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-400">{comp.positioning ?? comp.evidence}</p>
                      )}
                      {((comp.strengths && comp.strengths.length > 0) || (comp.weaknesses && comp.weaknesses.length > 0)) && (
                        <div className="mt-2 flex gap-4">
                          {comp.strengths && comp.strengths.length > 0 && (
                            <div className="flex-1">
                              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-500">Strengths</p>
                              <ul className="space-y-0.5">
                                {comp.strengths.map((s, si) => (
                                  <li key={si} className="text-[10px] text-zinc-400">+ {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {comp.weaknesses && comp.weaknesses.length > 0 && (
                            <div className="flex-1">
                              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-red-500">Weaknesses</p>
                              <ul className="space-y-0.5">
                                {comp.weaknesses.map((w, wi) => (
                                  <li key={wi} className="text-[10px] text-zinc-400">− {w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-600">No competitors identified in this bucket.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Top Threats */}
      {raw.topThreats && raw.topThreats.length > 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Top Threats</p>
          <div className="flex flex-wrap gap-1.5">
            {raw.topThreats.map((t, i) => (
              <span key={i} className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Content Gap Domains */}
      {raw.contentGapDomains && raw.contentGapDomains.length > 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Content Gap Domains</p>
          <div className="flex flex-wrap gap-1.5">
            {raw.contentGapDomains.map((d, i) => (
              <span key={i} className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation (if summary is structured) */}
      {summaryObj?.recommendation && (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
          <p className="text-[11px] text-zinc-400">{summaryObj.recommendation}</p>
        </div>
      )}
    </div>
  );
}

const BUCKET_COLORS: Record<string, string> = {
  direct: 'text-red-400',
  indirect: 'text-amber-400',
  content: 'text-blue-400',
  aspirational: 'text-violet-400',
};

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
    content: 'bg-blue-500/10 text-blue-400',
    niche: 'bg-blue-500/10 text-blue-400',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${colors[type] ?? colors.niche}`}>{type}</span>;
}

function ThreatBadge({ level }: { level: string | number }) {
  // Numeric threat level: 1 = highest threat
  if (typeof level === 'number') {
    const num = level as number;
    const cls = num === 1 ? 'bg-red-500/10 text-red-400' : num === 2 ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-700 text-zinc-400';
    const label = num === 1 ? 'High' : num === 2 ? 'Medium' : 'Low';
    return <span className={`rounded px-1.5 py-0.5 text-[9px] ${cls}`}>#{num} · {label}</span>;
  }
  const colors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-green-500/10 text-green-400',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[9px] ${colors[level] ?? 'bg-zinc-700 text-zinc-400'}`}>{level}</span>;
}
