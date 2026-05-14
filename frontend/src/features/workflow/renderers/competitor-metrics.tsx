'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

/* ── Types matching actual agent output ── */

interface BacklinkMetrics {
  live?: number;
  allTime?: number;
  liveRefDomains?: number;
  allTimeRefDomains?: number;
}

interface CompetitorEntry {
  domain: string;
  domainRating?: number;
  ahrefsRank?: number;
  backlinks?: BacklinkMetrics | number | null;
  organicKeywords?: unknown[];
  topPages?: unknown[];
}

interface CompetitorMetricsData {
  /* Agent output keys */
  targetMetrics?: CompetitorEntry;
  competitorMetrics?: CompetitorEntry[];
  gaps?: Record<string, unknown>;
  summary?: string | { strongestCompetitor?: string; weakestArea?: string; recommendation?: string };
  quickWins?: Record<string, Array<{ target?: string; competitor?: string; difference?: number }>>;
  benchmarks?: { averageBacklinks?: BacklinkMetrics; averageDomainRating?: number; avgDomainRating?: number; avgOrganicKeywords?: number; avgReferringDomains?: number; medianOrganicTraffic?: number };
  /* Legacy flat keys */
  competitors?: CompetitorEntry[];
  ourMetrics?: CompetitorEntry;
  [key: string]: unknown;
}

/* ── Helpers ── */

function resolveBacklinks(bl?: BacklinkMetrics | number | null): { live: number; refDomains: number } {
  if (bl == null) return { live: 0, refDomains: 0 };
  if (typeof bl === 'number') return { live: bl, refDomains: 0 };
  return { live: bl.live ?? 0, refDomains: bl.liveRefDomains ?? 0 };
}

function flattenGaps(
  gaps: unknown,
  target: CompetitorEntry | undefined,
  benchmarks: CompetitorMetricsData['benchmarks'],
): Array<{ metric: string; value: number; benchmark: number; gap: number }> {
  if (!gaps) return [];

  // New shape: gaps is an array of { metric, targetValue, benchmarkValue, gap, priority }
  if (Array.isArray(gaps)) {
    return gaps.map((g: Record<string, unknown>) => ({
      metric: String(g.metric ?? ''),
      value: Number(g.targetValue ?? 0),
      benchmark: Number(g.benchmarkValue ?? 0),
      gap: Number(g.gap ?? 0),
    }));
  }

  // Legacy shape: gaps is an object with domainRating, backlinks, etc.
  if (typeof gaps !== 'object') return [];
  const gapsObj = gaps as Record<string, unknown>;
  const rows: Array<{ metric: string; value: number; benchmark: number; gap: number }> = [];

  const dr = typeof gapsObj.domainRating === 'number' ? gapsObj.domainRating : undefined;
  if (dr !== undefined) {
    const ourDR = target?.domainRating ?? 0;
    const avgDR = benchmarks?.averageDomainRating ?? benchmarks?.avgDomainRating ?? ourDR;
    rows.push({ metric: 'Domain Rating', value: ourDR, benchmark: avgDR, gap: dr });
  }

  const bl = gapsObj.backlinks;
  if (bl && typeof bl === 'object') {
    const blObj = bl as BacklinkMetrics;
    const ourBl = resolveBacklinks(target?.backlinks);
    const avgBl = benchmarks?.averageBacklinks;
    if (blObj.live !== undefined) {
      rows.push({ metric: 'Live Backlinks', value: ourBl.live, benchmark: avgBl?.live ?? 0, gap: blObj.live });
    }
    if (blObj.liveRefDomains !== undefined) {
      rows.push({ metric: 'Referring Domains', value: ourBl.refDomains, benchmark: avgBl?.liveRefDomains ?? 0, gap: blObj.liveRefDomains });
    }
  }

  return rows;
}

/* ── Component ── */

export function CompetitorMetricsRenderer({ data }: { data: unknown }) {
  const raw = data as CompetitorMetricsData;

  if (!raw || typeof raw !== 'object') {
    return <p className="text-sm text-zinc-500">No competitor metrics data available.</p>;
  }

  const target = raw.targetMetrics ?? raw.ourMetrics;
  const allRows = [
    ...(target ? [{ ...target, _isTarget: true }] : []),
    ...(raw.competitorMetrics ?? raw.competitors ?? []).map((c) => ({ ...c, _isTarget: false })),
  ].sort((a, b) => (b.domainRating ?? 0) - (a.domainRating ?? 0)) as Array<CompetitorEntry & { _isTarget: boolean }>;
  const gapRows = flattenGaps(raw.gaps, target, raw.benchmarks);
  const summary = typeof raw.summary === 'string' ? raw.summary : raw.summary?.recommendation;
  // Normalize quickWins: agent may return flat array instead of keyed object
  let quickWins = raw.quickWins;
  if (Array.isArray(quickWins)) {
    const grouped: Record<string, Array<{ target?: string; competitor?: string; difference?: number }>> = {};
    for (const qw of quickWins as Array<Record<string, unknown>>) {
      const key = String(qw.metric ?? 'general');
      if (!grouped[key]) grouped[key] = [];
      const diff = (qw.difference as number) ?? ((Number(qw.targetValue) || 0) - (Number(qw.competitorValue) || 0));
      grouped[key].push({ target: qw.target as string, competitor: qw.competitor as string, difference: diff });
    }
    quickWins = grouped;
  }

  return (
    <div className="space-y-6">
      {/* Competitor Comparison Table */}
      {allRows.length > 0 && <SortableCompetitorTable rows={allRows} />}

      {/* Gaps vs Benchmarks */}
      {gapRows.length > 0 && (
        <div>
          <SectionLabel>Gaps vs. Benchmark</SectionLabel>
          <div className="mt-2 space-y-2">
            {gapRows.map((row, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <span className="text-sm text-zinc-200">{row.metric}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-500">You: {formatNumber(row.value)}</span>
                  <span className="text-zinc-500">Avg: {formatNumber(row.benchmark)}</span>
                  <span className={row.gap < 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {row.gap < 0 ? '' : '+'}{formatNumber(row.gap)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Wins */}
      {quickWins && Object.keys(quickWins).length > 0 && (
        <div>
          <SectionLabel>Quick Wins</SectionLabel>
          <div className="mt-2 space-y-1.5">
            {Object.entries(quickWins).flatMap(([category, items]) =>
              (Array.isArray(items) ? items : []).map((qw, i) => (
                <div key={`${category}-${i}`} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm">
                  <span className="text-zinc-200">
                    <span className="text-zinc-500">{formatMetricLabel(category)}:</span>{' '}
                    Beat <span className="font-medium text-zinc-100">{qw.competitor}</span>
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    +{qw.difference}
                  </span>
                </div>
              )),
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{summary}</p>
        </div>
      )}
    </div>
  );
}

function SortableCompetitorTable({ rows }: { rows: Array<CompetitorEntry & { _isTarget: boolean }> }) {
  type SK = 'domain' | 'domainRating' | 'backlinksLive' | 'refDomains' | 'ahrefsRank';
  const [sortKey, setSortKey] = useState<SK>('domainRating');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'domain' ? 'asc' : 'desc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (sortKey === 'domain') { va = a.domain ?? ''; vb = b.domain ?? ''; }
    else if (sortKey === 'backlinksLive') { va = resolveBacklinks(a.backlinks).live; vb = resolveBacklinks(b.backlinks).live; }
    else if (sortKey === 'refDomains') { va = resolveBacklinks(a.backlinks).refDomains; vb = resolveBacklinks(b.backlinks).refDomains; }
    else { va = ((a as unknown as Record<string, unknown>)[sortKey] as number) ?? 0; vb = ((b as unknown as Record<string, unknown>)[sortKey] as number) ?? 0; }
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (align: string) => `cursor-pointer select-none px-3 py-2 text-[10px] uppercase text-zinc-500 hover:text-zinc-300 ${align}`;

  return (
    <div>
      <SectionLabel>Competitor Comparison</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('domain')}><InfoTip tip="Competitor website URL">Domain{arrow('domain')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('domainRating')}><InfoTip tip="Domain Rating — Ahrefs authority score (0–100)">DR{arrow('domainRating')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('backlinksLive')}><InfoTip tip="Total live backlinks pointing to this domain">Backlinks{arrow('backlinksLive')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('refDomains')}><InfoTip tip="Unique domains linking to this site">Ref. Domains{arrow('refDomains')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('ahrefsRank')}><InfoTip tip="Global rank by Ahrefs (lower = stronger)">Ahrefs Rank{arrow('ahrefsRank')}</InfoTip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const bl = resolveBacklinks(row.backlinks);
              if (row._isTarget) {
                return (
                  <tr key={i} className="border-b border-zinc-800/50 bg-emerald-500/5">
                    <td className="px-3 py-2 font-medium text-emerald-400">{row.domain} (you)</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{row.domainRating ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(bl.live)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(bl.refDomains)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(row.ahrefsRank)}</td>
                  </tr>
                );
              }
              return (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-3 py-2 text-zinc-200">{row.domain}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">{row.domainRating ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(bl.live)}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(bl.refDomains)}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(row.ahrefsRank)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DRBadge({ value }: { value: number }) {
  const color = value >= 60 ? 'text-emerald-400' : value >= 30 ? 'text-amber-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{value}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}

function formatMetricLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
