'use client';

interface AiIntelligenceData {
  aiReadinessScore?: number;
  dimensions?: {
    structuredData?: { score: number; findings: string[] };
    contentClarity?: { score: number; findings: string[] };
    authoritySignals?: { score: number; findings: string[] };
    citabilityFormat?: { score: number; findings: string[] };
    brandPresence?: { score: number; findings: string[] };
  };
  aiMentions?: Array<{
    query: string;
    mentioned: boolean;
    position: string;
  }>;
  opportunities?: Array<{
    priority: string;
    title: string;
    description: string;
    expectedImpact: string;
  }>;
  summary?: string;
  [key: string]: unknown;
}

export function AiIntelligenceRenderer({ data }: { data: unknown }) {
  const intel = data as AiIntelligenceData;

  if (!intel || typeof intel !== 'object') {
    return <p className="text-sm text-zinc-500">No AI intelligence data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* AI Readiness Score */}
      {intel.aiReadinessScore !== undefined && (
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-violet-500/30 bg-violet-500/10">
            <span className="text-xl font-bold text-violet-400">{intel.aiReadinessScore}</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-100">AI Readiness Score</p>
            <p className="text-sm text-zinc-400">
              {intel.aiReadinessScore >= 70 ? 'Well-positioned for AI search' :
               intel.aiReadinessScore >= 40 ? 'Moderate AI visibility' : 'Significant improvement needed'}
            </p>
          </div>
        </div>
      )}

      {/* Dimensions */}
      {intel.dimensions && (
        <div>
          <SectionLabel>Dimension Scores</SectionLabel>
          <div className="mt-2 space-y-2">
            <DimensionRow label="Structured Data" dim={intel.dimensions.structuredData} />
            <DimensionRow label="Content Clarity" dim={intel.dimensions.contentClarity} />
            <DimensionRow label="Authority Signals" dim={intel.dimensions.authoritySignals} />
            <DimensionRow label="Citability Format" dim={intel.dimensions.citabilityFormat} />
            <DimensionRow label="Brand Presence" dim={intel.dimensions.brandPresence} />
          </div>
        </div>
      )}

      {/* AI Mentions */}
      {intel.aiMentions && intel.aiMentions.length > 0 && (
        <div>
          <SectionLabel>Brand Mentions in AI Contexts</SectionLabel>
          <div className="mt-2 space-y-1">
            {intel.aiMentions.map((mention, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <span className="text-sm text-zinc-300">{mention.query}</span>
                <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                  mention.mentioned ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'
                }`}>
                  {mention.position}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {intel.opportunities && intel.opportunities.length > 0 && (
        <div>
          <SectionLabel>Opportunities</SectionLabel>
          <div className="mt-2 space-y-2">
            {intel.opportunities.map((opp, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={opp.priority} />
                  <span className="text-sm font-medium text-zinc-200">{opp.title}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{opp.description}</p>
                <p className="mt-1 text-xs text-violet-400">Impact: {opp.expectedImpact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {intel.summary && (
        <div>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{intel.summary}</p>
        </div>
      )}
    </div>
  );
}

function DimensionRow({ label, dim }: { label: string; dim?: { score: number; findings: string[] } }) {
  if (!dim) return null;
  const pct = Math.min(100, Math.max(0, dim.score));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="text-sm font-semibold text-zinc-100">{dim.score}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-blue-500/20 text-blue-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[priority] ?? 'bg-zinc-700 text-zinc-300'}`}>
      {priority}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}
