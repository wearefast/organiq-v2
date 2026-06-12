'use client';

import { useState, useMemo } from 'react';
import { InfoTip } from '@/shared/components';

interface EnrichedKeyword {
  keyword: string;
  category?: string;
  intent?: string;
  volume?: number;
  difficulty?: number;
  opportunityScore?: number;
  cpc?: number;
  /* nested shape from pipeline */
  metrics?: { searchVolume?: number; keywordDifficulty?: number; cpc?: number; competition?: string; trend?: string };
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

/* Normalised flat keyword row used in all tables/distributions */
interface KwRow {
  keyword: string;
  volume: number;
  difficulty: number;
  opportunityScore: number;
  competition: string;
  intent: string;
}

export function SearchDemandRenderer({ data }: { data: unknown }) {
  const demand = data as SearchDemandData;

  if (!demand || typeof demand !== 'object') {
    return <p className="text-sm text-zinc-500">No search demand data available.</p>;
  }

  /* Normalise enrichedKeywords into flat rows */
  const kwRows: KwRow[] = (demand.enrichedKeywords ?? []).map((e) => ({
    keyword: e.keyword,
    volume: e.volume ?? e.metrics?.searchVolume ?? 0,
    difficulty: e.difficulty ?? e.metrics?.keywordDifficulty ?? 0,
    opportunityScore: e.opportunityScore ?? 0,
    competition: e.metrics?.competition ?? (((e.difficulty ?? e.metrics?.keywordDifficulty ?? 0) > 60) ? 'high' : (e.difficulty ?? e.metrics?.keywordDifficulty ?? 0) > 30 ? 'medium' : 'low'),
    intent: e.intent ?? 'informational',
  }));

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

  /* Derived stats */
  const withVolume = kwRows.filter((r) => r.volume > 0);
  const avgKD = kwRows.length > 0 ? Math.round(kwRows.reduce((s, r) => s + r.difficulty, 0) / kwRows.length) : 0;
  const medianVolume = (() => {
    if (withVolume.length === 0) return 0;
    const sorted = [...withVolume].sort((a, b) => a.volume - b.volume);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1].volume + sorted[mid].volume) / 2) : sorted[mid].volume;
  })();

  /* KD distribution */
  const kdEasy = kwRows.filter((r) => r.difficulty <= 30).length;
  const kdMedium = kwRows.filter((r) => r.difficulty > 30 && r.difficulty <= 60).length;
  const kdHard = kwRows.filter((r) => r.difficulty > 60).length;

  /* Volume distribution */
  const volBuckets = [
    { label: '0', min: 0, max: 0 },
    { label: '1–100', min: 1, max: 100 },
    { label: '101–500', min: 101, max: 500 },
    { label: '501–1K', min: 501, max: 1000 },
    { label: '1K+', min: 1001, max: Infinity },
  ].map((b) => ({ ...b, count: kwRows.filter((r) => r.volume >= b.min && r.volume <= b.max).length }));

  return (
    <div className="space-y-6">
      {/* Row 1: 4 headline stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Total Addressable Volume"
          value={formatNumber(demand.totalAddressableVolume)}
          subtitle="Monthly searches"
          tip="Sum of all monthly searches across your keyword universe"
        />
        <MetricCard
          label="Realistic Target Volume"
          value={formatNumber(demand.realisticTargetVolume)}
          subtitle="Est. achievable traffic"
          tip="~10% of total addressable volume — accounts for average CTR at non-dominant positions"
        />
        <MetricCard
          label="Keywords Analyzed"
          value={`${withVolume.length} / ${kwRows.length}`}
          subtitle="have search volume"
          tip="Number of keywords with non-zero search volume out of total analyzed"
          highlight={withVolume.length === kwRows.length}
        />
        <MetricCard
          label="Avg Keyword Difficulty"
          value={avgKD > 0 ? String(avgKD) : '—'}
          subtitle={avgKD <= 30 ? 'Easy — low competition' : avgKD <= 60 ? 'Medium competition' : 'Hard — high competition'}
          tip="Average KD across all keywords. Lower = easier to rank."
          difficultyValue={avgKD > 0 ? avgKD : undefined}
        />
      </div>

      {/* Row 2: KD Distribution + Volume Distribution side-by-side */}
      {kwRows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DistributionCard
            title="Keyword Difficulty Distribution"
            tip="How competitive your keyword set is. More 'Easy' = faster ranking wins."
            buckets={[
              { label: 'Easy (KD ≤ 30)', count: kdEasy, color: 'bg-green-500', textColor: 'text-green-400' },
              { label: 'Medium (KD 31–60)', count: kdMedium, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
              { label: 'Hard (KD > 60)', count: kdHard, color: 'bg-red-500', textColor: 'text-red-400' },
            ]}
            total={kwRows.length}
          />
          <DistributionCard
            title="Volume Distribution"
            tip="How search volume is spread across your keywords. Most keywords tend to be low-volume long-tails."
            buckets={volBuckets.map((b) => ({
              label: b.label,
              count: b.count,
              color: 'bg-violet-500',
              textColor: 'text-violet-400',
            }))}
            total={kwRows.length}
          />
        </div>
      )}

      {/* Demand by Intent */}
      {intentEntries.filter(([, v]) => v > 0).length > 0 && (
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

      {/* High Opportunity Keywords */}
      {highOpp.length > 0 && (
        <div>
          <SectionLabel>
            <InfoTip tip="Top keywords ranked by opportunity score — a blend of search volume and low keyword difficulty. Best candidates for quick ranking wins.">
              Top Opportunity Keywords
            </InfoTip>
          </SectionLabel>
          <div className="mt-2 space-y-1.5">
            {highOpp.slice(0, 10).map((kw, i) => {
              const enriched = typeof kw.keyword === 'string' ? enrichedMap.get(kw.keyword) : undefined;
              const volume = kw.volume ?? enriched?.volume ?? enriched?.metrics?.searchVolume;
              const difficulty = kw.difficulty ?? enriched?.difficulty ?? enriched?.metrics?.keywordDifficulty;
              const score = kw.opportunityScore ?? enriched?.opportunityScore;
              return (
                <div key={i} className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-zinc-600">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-200">{kw.keyword}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {volume !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-500">vol</span>
                        <span className="font-medium text-zinc-300">{formatNumber(volume)}</span>
                      </span>
                    )}
                    {difficulty !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-500">KD</span>
                        <DifficultyBadge value={difficulty} />
                      </span>
                    )}
                    {score !== undefined && (
                      <span
                        className="w-10 rounded px-1.5 py-0.5 text-center font-semibold"
                        style={{
                          background: `hsl(${Math.round(score * 120)}, 70%, 15%)`,
                          color: `hsl(${Math.round(score * 120)}, 80%, 60%)`,
                        }}
                      >
                        {(score * 100).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Keywords Table */}
      {kwRows.length > 0 && (
        <AllKeywordsTable rows={kwRows} medianVolume={medianVolume} />
      )}

      {/* Demand by Category */}
      {categoryRows.length > 0 && (
        <SortableCategoryTable rows={categoryRows} />
      )}

      {/* Summary */}
      {demand.summary && (
        <div>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{demand.summary}</p>
        </div>
      )}
    </div>
  );
}

function AllKeywordsTable({ rows, medianVolume }: { rows: KwRow[]; medianVolume: number }) {
  type SK = 'keyword' | 'volume' | 'difficulty' | 'opportunityScore';
  const [sortKey, setSortKey] = useState<SK>('opportunityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'keyword' ? 'asc' : 'desc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => !q || r.keyword.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (Number(va) || 0) - (Number(vb) || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = 'cursor-pointer select-none px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>
          <InfoTip tip="All keywords from the seed list with their search volume, difficulty, and opportunity score.">
            All Keywords ({rows.length})
          </InfoTip>
        </SectionLabel>
        <input
          type="text"
          placeholder="Filter keywords…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-zinc-800 bg-zinc-950">
                <th className={`${th} text-left`} onClick={() => handleSort('keyword')}>
                  Keyword{arrow('keyword')}
                </th>
                <th className={`${th} text-right`} onClick={() => handleSort('volume')}>
                  <InfoTip tip="Monthly search volume">Volume{arrow('volume')}</InfoTip>
                </th>
                <th className={`${th} text-right`} onClick={() => handleSort('difficulty')}>
                  <InfoTip tip="Keyword difficulty (0–100). Lower = easier to rank.">KD{arrow('difficulty')}</InfoTip>
                </th>
                <th className={`${th} text-right`} onClick={() => handleSort('opportunityScore')}>
                  <InfoTip tip="Opportunity score: blends volume potential and ranking ease. Higher = better target.">Opp{arrow('opportunityScore')}</InfoTip>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isAboveMedian = row.volume > medianVolume;
                return (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="max-w-[220px] px-3 py-2">
                      <span className="block truncate text-zinc-200" title={row.keyword}>{row.keyword}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-xs font-medium ${isAboveMedian ? 'text-zinc-200' : 'text-zinc-500'}`}>
                        {row.volume > 0 ? formatNumber(row.volume) : <span className="text-zinc-700">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.difficulty > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <DifficultyBar value={row.difficulty} />
                          <DifficultyBadge value={row.difficulty} />
                        </span>
                      ) : <span className="text-xs text-zinc-700">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.opportunityScore > 0 ? (
                        <span
                          className="inline-block w-9 rounded px-1 py-0.5 text-center text-[11px] font-bold"
                          style={{
                            background: `hsl(${Math.round(row.opportunityScore * 120)}, 70%, 12%)`,
                            color: `hsl(${Math.round(row.opportunityScore * 120)}, 80%, 58%)`,
                          }}
                        >
                          {(row.opportunityScore * 100).toFixed(0)}
                        </span>
                      ) : <span className="text-xs text-zinc-700">—</span>}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-zinc-600">No keywords match your filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DistributionCard({ title, tip, buckets, total }: {
  title: string;
  tip: string;
  buckets: Array<{ label: string; count: number; color: string; textColor: string }>;
  total: number;
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <InfoTip tip={tip}>{title}</InfoTip>
      </p>
      <div className="space-y-2">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className={`w-24 shrink-0 text-[11px] ${b.textColor}`}>{b.label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-zinc-800" style={{ height: 6 }}>
              <div
                className={`h-full rounded-full transition-all ${b.color} opacity-70`}
                style={{ width: total > 0 ? `${(b.count / max) * 100}%` : '0%' }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-[11px] text-zinc-400">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableCategoryTable({ rows }: { rows: Array<{ category: string; totalVolume: number; avgDifficulty?: number; keywordCount?: number }> }) {
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

function MetricCard({ label, value, subtitle, tip, highlight, difficultyValue }: {
  label: string; value: string; subtitle: string; tip?: string; highlight?: boolean; difficultyValue?: number;
}) {
  const valColor = difficultyValue !== undefined
    ? difficultyValue <= 30 ? 'text-green-400' : difficultyValue <= 60 ? 'text-yellow-400' : 'text-red-400'
    : 'text-zinc-100';
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
      <p className={`mt-1 text-2xl font-bold ${valColor}`}>{value}</p>
      <p className="text-[10px] text-zinc-500">{subtitle}</p>
    </div>
  );
}

function DifficultyBar({ value }: { value: number }) {
  const color = value <= 30 ? 'bg-green-500' : value <= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-zinc-800">
      <span className={`block h-full ${color} opacity-70`} style={{ width: `${Math.min(value, 100)}%` }} />
    </span>
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
