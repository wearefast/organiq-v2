'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

interface EnrichedKeyword {
  keyword: string;
  category?: string;
  intent?: string;
  volume?: number;
  difficulty?: number;
  opportunityScore?: number;
  cpc?: number;
  /* legacy nested shape */
  metrics?: { searchVolume?: number; keywordDifficulty?: number; cpc?: number };
}

interface SearchDemandData {
  enrichedKeywords?: EnrichedKeyword[];
  /* demandByCategory: array shape OR object shape */
  demandByCategory?: Array<{ category: string; totalVolume: number; avgDifficulty?: number; keywordCount?: number }> | Record<string, number>;
  /* demandByIntent: object shape — either {intent: number} or {intent: {volume, count, avgDifficulty}} */
  demandByIntent?: Record<string, number | { volume: number; count?: number; avgDifficulty?: number }>;
  /* highOpportunity: array of strings OR array of objects */
  highOpportunity?: Array<string | { keyword: string; volume?: number; difficulty?: number; opportunityScore?: number; rationale?: string }>;
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

  /* Normalize demandByIntent → always { intent: volume } */
  const intentEntries: Array<[string, number]> = demand.demandByIntent
    ? Object.entries(demand.demandByIntent).map(([k, v]) => [
        k,
        typeof v === 'number' ? v : (v as { volume: number }).volume ?? 0,
      ])
    : [];

  /* Normalize demandByCategory → always array of {category, totalVolume} */
  let categoryRows: Array<{ category: string; totalVolume: number; avgDifficulty?: number; keywordCount?: number }> = [];
  if (Array.isArray(demand.demandByCategory)) {
    categoryRows = demand.demandByCategory;
  } else if (demand.demandByCategory && typeof demand.demandByCategory === 'object') {
    categoryRows = Object.entries(demand.demandByCategory as Record<string, number>)
      .map(([category, totalVolume]) => ({ category, totalVolume }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }

  /* Normalize highOpportunity → always array of {keyword, ...} */
  const highOpp = (demand.highOpportunity ?? []).map((item) =>
    typeof item === 'string' ? { keyword: item } : item,
  );

  /* Pull enrichedKeywords for extra detail when highOpp are strings */
  const enrichedMap = new Map(
    (demand.enrichedKeywords ?? []).map((e) => [e.keyword, e]),
  );

  return (
    <div className="space-y-6">
      {/* Volume Headlines */}
      {(demand.totalAddressableVolume !== undefined || demand.realisticTargetVolume !== undefined) && (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Total Addressable Volume"
            value={formatNumber(demand.totalAddressableVolume)}
            subtitle="Monthly searches"
            tip="Sum of all monthly searches across your keyword universe"
          />
          <MetricCard
            label="Realistic Target Volume"
            value={formatNumber(demand.realisticTargetVolume)}
            subtitle="Achievable traffic"
            tip="Achievable traffic based on current positioning"
          />
        </div>
      )}

      {/* Demand by Intent */}
      {intentEntries.length > 0 && (
        <div>
          <SectionLabel>Demand by Intent</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {intentEntries.map(([intent, volume]) => (
              <div key={intent} className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-500">{intent}</p>
                <p className="text-sm font-semibold text-zinc-100">{formatNumber(volume)}</p>
                <p className="text-[10px] text-zinc-500">monthly vol</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demand by Category */}
      {categoryRows.length > 0 && (
        <SortableCategoryTable rows={categoryRows} />
      )}

      {/* High Opportunity Keywords */}
      {highOpp.length > 0 && (
        <div>
          <SectionLabel>High Opportunity Keywords</SectionLabel>
          <div className="mt-2 space-y-2">
            {highOpp.slice(0, 10).map((kw, i) => {
              const enriched = typeof kw.keyword === 'string' ? enrichedMap.get(kw.keyword) : undefined;
              const volume = kw.volume ?? enriched?.volume ?? enriched?.metrics?.searchVolume;
              const difficulty = kw.difficulty ?? enriched?.difficulty ?? enriched?.metrics?.keywordDifficulty;
              const score = kw.opportunityScore ?? enriched?.opportunityScore;
              return (
                <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-zinc-200">{kw.keyword}</span>
                    {kw.rationale && <p className="text-[10px] text-zinc-500">{kw.rationale}</p>}
                    {enriched?.intent && <p className="text-[10px] text-zinc-500">{enriched.intent} · {enriched.category}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {volume !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-500">vol</span>
                        <span className="text-zinc-400">{formatNumber(volume)}</span>
                      </span>
                    )}
                    {difficulty !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-500">KD</span>
                        <DifficultyBadge value={difficulty} />
                      </span>
                    )}
                    {score !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-500">opp</span>
                        <span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-medium text-violet-400">
                          {(score * 100).toFixed(0)}%
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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

function SortableCategoryTable({ rows }: { rows: Array<{ category: string; totalVolume: number; avgDifficulty?: number }> }) {
  type SK = 'category' | 'totalVolume' | 'avgDifficulty';
  const [sortKey, setSortKey] = useState<SK>('totalVolume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const hasKD = rows.some(r => r.avgDifficulty !== undefined);

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'category' ? 'asc' : 'desc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (align: string) => `cursor-pointer select-none px-3 py-2 text-[10px] uppercase text-zinc-500 hover:text-zinc-300 ${align}`;

  return (
    <div>
      <SectionLabel>Demand by Category</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('category')}><InfoTip tip="Keyword topic grouping">Category{arrow('category')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('totalVolume')}><InfoTip tip="Total monthly searches in this category">Volume{arrow('totalVolume')}</InfoTip></th>
              {hasKD && <th className={th('text-right')} onClick={() => handleSort('avgDifficulty')}><InfoTip tip="Average keyword difficulty in category">Avg KD{arrow('avgDifficulty')}</InfoTip></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((cat, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-300">{cat.category}</td>
                <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(cat.totalVolume)}</td>
                {hasKD && <td className="px-3 py-2 text-right"><DifficultyBadge value={cat.avgDifficulty ?? 0} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtitle, tip }: { label: string; value: string; subtitle: string; tip?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-100">{value}</p>
      <p className="text-[10px] text-zinc-500">{subtitle}</p>
    </div>
  );
}

function DifficultyBadge({ value, showLabel }: { value: number; showLabel?: boolean }) {
  const color = value <= 30 ? 'text-green-400' : value <= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{showLabel ? 'KD: ' : ''}{Math.round(value)}</span>;
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
