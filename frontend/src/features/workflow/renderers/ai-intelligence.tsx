'use client';

import { InfoTip } from '@/shared/components';

interface AiIntelligenceData {
  aiReadinessScore?: number;
  dimensions?: Record<string, unknown>;
  aiMentions?: Record<string, unknown[]> | Array<{
    query: string;
    mentioned: boolean;
    position: string;
  }>;
  opportunities?: Array<string | {
    priority?: string;
    title?: string;
    description?: string;
    expectedImpact?: string;
  }>;
  summary?: string;
  [key: string]: unknown;
}

interface NormalizedDimension {
  score: number;
  findings: string[];
}

/** Case-insensitive + space-insensitive dimension lookup */
function findDimension(dims: Record<string, unknown>, key: string): NormalizedDimension | null {
  const normalKey = key.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(dims)) {
    if (k.toLowerCase().replace(/\s+/g, '') === normalKey) {
      if (typeof v === 'number') return { score: v, findings: [] };
      if (typeof v === 'object' && v !== null && 'score' in v) {
        const obj = v as { score: number; findings?: string[] };
        return { score: obj.score, findings: obj.findings ?? [] };
      }
    }
  }
  return null;
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
            <p className="text-lg font-semibold text-zinc-100"><InfoTip tip="Likelihood your domain is cited by AI engines (0–100)">AI Readiness Score</InfoTip></p>
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
            <DimensionRow label="Structured Data" dim={findDimension(intel.dimensions, 'structuredData')} tip="Schema markup quality & coverage" />
            <DimensionRow label="Content Clarity" dim={findDimension(intel.dimensions, 'contentClarity')} tip="How clearly content answers questions" />
            <DimensionRow label="Authority Signals" dim={findDimension(intel.dimensions, 'authoritySignals')} tip="E-E-A-T and trust signals" />
            <DimensionRow label="Citability Format" dim={findDimension(intel.dimensions, 'citabilityFormat')} tip="Suitability for AI extraction & citation" />
            <DimensionRow label="Brand Presence" dim={findDimension(intel.dimensions, 'brandPresence')} tip="Online brand visibility & mentions" />
          </div>
        </div>
      )}

      {/* AI Mentions */}
      {intel.aiMentions && (
        <div>
          <SectionLabel>Brand Mentions in AI Contexts</SectionLabel>
          <div className="mt-2 space-y-1">
            {Array.isArray(intel.aiMentions)
              ? intel.aiMentions.map((mention, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                    <span className="text-sm text-zinc-300">{mention.query}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                      mention.mentioned ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'
                    }`}>
                      {mention.position}
                    </span>
                  </div>
                ))
              : Object.entries(intel.aiMentions).map(([category, items]) => (
                  <div key={category} className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                    <p className="text-xs font-medium text-zinc-400 capitalize mb-1">
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    {Array.isArray(items) && items.map((item, j) => {
                      if (typeof item === 'string') {
                        return <p key={j} className="text-sm text-zinc-300 ml-2">• {item}</p>;
                      }
                      const obj = item as Record<string, unknown>;
                      const title = (obj.title as string) ?? '';
                      const link = (obj.link as string) ?? '';
                      const snippet = (obj.snippet as string) ?? '';
                      return (
                        <div key={j} className="ml-2 mb-2 last:mb-0">
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-violet-400 hover:underline">
                              {title || link}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-zinc-200">{title}</p>
                          )}
                          {snippet && <p className="text-xs text-zinc-400 mt-0.5">{snippet}</p>}
                        </div>
                      );
                    })}
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* Opportunities */}
      {intel.opportunities && intel.opportunities.length > 0 && (
        <div>
          <SectionLabel>Opportunities</SectionLabel>
          <div className="mt-2 space-y-2">
            {intel.opportunities.map((opp, i) => {
              if (typeof opp === 'string') {
                return (
                  <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                    <p className="text-sm text-zinc-200">{opp}</p>
                  </div>
                );
              }
              return (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="flex items-center gap-2">
                    {opp.priority && <PriorityBadge priority={opp.priority} />}
                    <span className="text-sm font-medium text-zinc-200">{opp.title}</span>
                  </div>
                  {opp.description && <p className="mt-1 text-xs text-zinc-400">{opp.description}</p>}
                  {opp.expectedImpact && <p className="mt-1 text-xs text-violet-400">Impact: {opp.expectedImpact}</p>}
                </div>
              );
            })}
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

function DimensionRow({ label, dim, tip }: { label: string; dim: NormalizedDimension | null; tip?: string }) {
  if (!dim) return null;
  const pct = Math.min(100, Math.max(0, dim.score));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-300">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</span>
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
