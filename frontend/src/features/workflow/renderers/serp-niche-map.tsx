'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

interface SerpEntry {
  keyword: string;
  volume?: number;
  difficulty?: number;
  serpType?: string;
  topDomains?: string[];
  features?: string[];
}

interface NicheSegment {
  name?: string;
  segment?: string;
  keywords?: string[];
  totalVolume?: number;
  dominantPlayers?: string[];
  dominantContentType?: string;
  competitionLevel?: string;
  averageAuthority?: string;
  opportunity?: string;
}

interface DominantPlayer {
  domain: string;
  estimatedAuthority?: string;
  contentFocus?: string;
  serpPresence?: number;
}

interface Opportunity {
  type?: string;
  description: string;
  keywords?: string[];
  rationale?: string;
}

interface SerpNicheMapData {
  serpEntries?: SerpEntry[];
  nicheSegments?: (NicheSegment | string)[];
  dominantDomains?: Array<{
    domain: string;
    keywordsRanking: number;
    avgPosition: number;
    visibility: number;
  }>;
  summary?: string | {
    totalKeywordsAnalyzed: number;
    nichesIdentified: number;
    avgDifficulty: number;
    topOpportunity: string;
  };
  opportunities?: Array<string | Opportunity>;
  dominantPlayers?: Array<string | DominantPlayer>;
  contentTypeDistribution?: Record<string, string | number>;
  serpFeatureDistribution?: Record<string, string | number>;
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
      {niche.summary && typeof niche.summary === 'object' && (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Keywords Analyzed" value={String(niche.summary.totalKeywordsAnalyzed)} tip="Total unique keywords analyzed in SERP" />
          <MetricCard label="Niches Found" value={String(niche.summary.nichesIdentified)} tip="Distinct market segments identified" />
          <MetricCard label="Avg Difficulty" value={String(niche.summary.avgDifficulty)} tip="Average keyword difficulty across all niches" />
          <MetricCard label="Top Opportunity" value={niche.summary.topOpportunity} tip="Highest-opportunity niche segment" />
        </div>
      )}

      {/* Text summary from agent */}
      {niche.summary && typeof niche.summary === 'string' && (
        <div>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{niche.summary}</p>
        </div>
      )}

      {/* Niche Segments */}
      {niche.nicheSegments && niche.nicheSegments.length > 0 && (
        <div>
          <SectionLabel>Niche Segments ({niche.nicheSegments.length})</SectionLabel>
          <div className="mt-2 space-y-2">
            {niche.nicheSegments.map((rawSeg, i) => {
              // Agent may return plain strings instead of objects
              if (typeof rawSeg === 'string') {
                return (
                  <span key={i} className="mr-2 inline-block rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{rawSeg}</span>
                );
              }
              const seg = rawSeg as NicheSegment;
              return (
                <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">{seg.name ?? seg.segment}</span>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      {seg.keywords && <span>{seg.keywords.length} kws</span>}
                      {seg.totalVolume != null && <span>{formatNumber(seg.totalVolume)} vol</span>}
                      {seg.opportunity && <OpportunityBadge level={seg.opportunity} />}
                    </div>
                  </div>
                  {seg.dominantPlayers && seg.dominantPlayers.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {seg.dominantPlayers.slice(0, 4).map((d, j) => (
                        <span key={j} className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                          {typeof d === 'string' ? d : (d as { name: string }).name ?? JSON.stringify(d)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dominant Domains */}
      {niche.dominantDomains && niche.dominantDomains.length > 0 && (
        <SortableDominantDomainsTable domains={niche.dominantDomains} />
      )}

      {/* Dominant Players (top-level, from agent) */}
      {niche.dominantPlayers && niche.dominantPlayers.length > 0 && (
        <div>
          <SectionLabel>Dominant Players ({niche.dominantPlayers.length})</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {niche.dominantPlayers.map((p, i) => {
              const label = typeof p === 'string' ? p : p.domain;
              return (
                <span key={i} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{label}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {niche.opportunities && niche.opportunities.length > 0 && (
        <div>
          <SectionLabel>Opportunities</SectionLabel>
          <div className="mt-2 space-y-1.5">
            {niche.opportunities.map((opp, i) => {
              const text = typeof opp === 'string' ? opp : opp.description;
              const type = typeof opp === 'object' ? opp.type : undefined;
              return (
                <div key={i} className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {type && <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] uppercase text-violet-400">{type.replace(/_/g, ' ')}</span>}
                    <p className="text-sm text-zinc-300">{text}</p>
                  </div>
                  {typeof opp === 'object' && opp.rationale && (
                    <p className="mt-1 text-[11px] text-zinc-500">{opp.rationale}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Type Distribution */}
      {niche.contentTypeDistribution && Object.keys(niche.contentTypeDistribution).length > 0 && (
        <div>
          <SectionLabel>Content Type Distribution</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(niche.contentTypeDistribution).map(([type, level]) => (
              <div key={type} className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-center">
                <p className="text-xs text-zinc-400">{type}</p>
                <p className="mt-0.5 text-sm font-medium text-zinc-200">{formatDistribution(level)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SERP Feature Distribution */}
      {niche.serpFeatureDistribution && Object.keys(niche.serpFeatureDistribution).length > 0 && (
        <div>
          <SectionLabel>SERP Feature Distribution</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(niche.serpFeatureDistribution).map(([feature, level]) => (
              <div key={feature} className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-center">
                <p className="text-xs text-zinc-400">{feature.replace(/_/g, ' ')}</p>
                <p className="mt-0.5 text-sm font-medium text-zinc-200">{formatDistribution(level)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableDominantDomainsTable({ domains }: { domains: Array<{ domain: string; keywordsRanking: number; avgPosition: number; visibility: number }> }) {
  type SK = 'domain' | 'keywordsRanking' | 'avgPosition' | 'visibility';
  const [sortKey, setSortKey] = useState<SK>('keywordsRanking');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'domain' || key === 'avgPosition' ? 'asc' : 'desc'); }
  };

  const sorted = [...domains].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (align: string) => `cursor-pointer select-none px-3 py-2 text-[10px] uppercase text-zinc-500 hover:text-zinc-300 ${align}`;

  return (
    <div>
      <SectionLabel>Dominant Domains</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('domain')}><InfoTip tip="Website competing in this niche">Domain{arrow('domain')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('keywordsRanking')}><InfoTip tip="Count of keywords this domain ranks for">Keywords{arrow('keywordsRanking')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('avgPosition')}><InfoTip tip="Average SERP position across keywords">Avg Pos{arrow('avgPosition')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('visibility')}><InfoTip tip="Estimated organic search visibility (0–100%)">Visibility{arrow('visibility')}</InfoTip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 10).map((d, i) => (
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
  );
}

function MetricCard({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
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

function formatDistribution(val: string | number): string {
  if (typeof val === 'number') return `${(val * 100).toFixed(0)}%`;
  return val;
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
