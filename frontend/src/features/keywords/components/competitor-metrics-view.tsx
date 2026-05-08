'use client';

import { useState } from 'react';

type TopPage = {
  url: string;
  traffic?: number | null;
  topKeyword?: string | null;
  topKeywordVolume?: number | null;
  topKeywordPosition?: number | null;
};

type CompetitorMetric = {
  domain: string;
  bucket?: string | null;
  domainRating?: number | null;
  organicTraffic?: number | null;
  organicKeywords?: number | null;
  referringDomains?: number | null;
  backlinks?: number | null;
  topPages?: TopPage[];
};

interface CompetitorMetricsViewProps {
  competitorMetrics: CompetitorMetric[];
}

type SortKey = 'domainRating' | 'organicTraffic' | 'backlinks' | 'organicKeywords';
type BucketFilter = 'ALL' | 'DIRECT' | 'ORGANIC' | 'UNCLASSIFIED';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function BucketBadge({ bucket }: { bucket?: string | null }) {
  if (!bucket) return null;
  const styles: Record<string, string> = {
    DIRECT: 'bg-[#EEF4FF] text-[#3538CD]',
    ORGANIC: 'bg-[#F0FDF4] text-[#15803D]',
    UNCLASSIFIED: 'bg-[#F9FAFB] text-[#667085]',
  };
  const cls = styles[bucket] ?? 'bg-[#F9FAFB] text-[#667085]';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {bucket.charAt(0) + bucket.slice(1).toLowerCase()}
    </span>
  );
}

function DrBadge({ dr }: { dr?: number | null }) {
  if (dr == null) return null;
  let bg = 'bg-[#F9FAFB] text-[#667085]';
  if (dr >= 70) bg = 'bg-[#FFF7ED] text-[#C2410C]';
  else if (dr >= 40) bg = 'bg-[#FFFBEB] text-[#B45309]';
  else if (dr >= 20) bg = 'bg-[#EEF4FF] text-[#3538CD]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg}`}>
      DR {dr}
    </span>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[#F8F9FC] px-4 py-3 text-center">
      <span className="text-base font-semibold text-[#111827]">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#9DA4AE]">{label}</span>
    </div>
  );
}

function TopPagesTable({ pages }: { pages: TopPage[] }) {
  if (!pages.length) {
    return <p className="mt-3 text-sm text-[#9DA4AE]">No top pages recorded.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[#E8EAF0]">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[#E8EAF0] bg-[#F8F9FC]">
            <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-[#667085]">URL</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.07em] text-[#667085]">Traffic</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-[#667085]">Top Keyword</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.07em] text-[#667085]">Volume</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.07em] text-[#667085]">Position</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F2F4F7] bg-white">
          {pages.map((p, i) => {
            let urlLabel = p.url;
            try { urlLabel = new URL(p.url).pathname || '/'; } catch { /* ok */ }
            return (
              <tr key={i} className="hover:bg-[#FAFAFB]">
                <td className="max-w-[260px] px-4 py-2.5">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-[#3538CD] hover:underline"
                    title={p.url}
                  >
                    {urlLabel}
                  </a>
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-medium text-[#111827]">{fmt(p.traffic)}</td>
                <td className="max-w-[200px] px-4 py-2.5">
                  <span className="block truncate text-xs text-[#344054]" title={p.topKeyword ?? ''}>
                    {p.topKeyword ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-[#344054]">{fmt(p.topKeywordVolume)}</td>
                <td className="px-4 py-2.5 text-right">
                  {p.topKeywordPosition != null ? (
                    <span className="inline-flex items-center rounded-full bg-[#F0FDF4] px-2 py-0.5 text-xs font-semibold text-[#15803D]">
                      #{p.topKeywordPosition}
                    </span>
                  ) : (
                    <span className="text-xs text-[#9DA4AE]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompetitorCard({ competitor }: { competitor: CompetitorMetric }) {
  const [expanded, setExpanded] = useState(false);
  const pages = competitor.topPages ?? [];

  return (
    <div className="rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F4F7] text-xs font-bold text-[#344054]">
            {competitor.domain.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-sm font-semibold text-[#111827]">{competitor.domain}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BucketBadge bucket={competitor.bucket} />
          <DrBadge dr={competitor.domainRating} />
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-3 px-5 py-4">
        <StatTile label="Backlinks" value={fmt(competitor.backlinks)} />
        <StatTile label="Org. Traffic" value={fmt(competitor.organicTraffic)} />
        <StatTile label="Org. Keywords" value={fmt(competitor.organicKeywords)} />
        <StatTile label="Ref. Domains" value={fmt(competitor.referringDomains)} />
      </div>

      {/* Top Pages toggle */}
      {pages.length > 0 && (
        <div className="border-t border-[#F2F4F7] px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-[#667085] hover:text-[#344054]"
          >
            <span>Top pages ({pages.length})</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded && <TopPagesTable pages={pages} />}
        </div>
      )}
    </div>
  );
}

export function CompetitorMetricsView({ competitorMetrics }: CompetitorMetricsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('domainRating');
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('ALL');

  const buckets = ['ALL', ...Array.from(new Set(competitorMetrics.map(c => c.bucket ?? 'UNCLASSIFIED')))] as BucketFilter[];

  const filtered = competitorMetrics
    .filter(c => bucketFilter === 'ALL' || (c.bucket ?? 'UNCLASSIFIED') === bucketFilter)
    .slice()
    .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));

  const avgDr = competitorMetrics.length
    ? Math.round(competitorMetrics.reduce((s, c) => s + (c.domainRating ?? 0), 0) / competitorMetrics.length)
    : 0;

  const totalTraffic = competitorMetrics.reduce((s, c) => s + (c.organicTraffic ?? 0), 0);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'domainRating', label: 'Domain Rating' },
    { key: 'organicTraffic', label: 'Org. Traffic' },
    { key: 'backlinks', label: 'Backlinks' },
    { key: 'organicKeywords', label: 'Org. Keywords' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E8EAF0] bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-1 flex-wrap gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#9DA4AE]">Competitors</p>
            <p className="mt-0.5 text-xl font-bold text-[#111827]">{competitorMetrics.length}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#9DA4AE]">Avg Domain Rating</p>
            <p className="mt-0.5 text-xl font-bold text-[#111827]">{avgDr}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#9DA4AE]">Total Org. Traffic</p>
            <p className="mt-0.5 text-xl font-bold text-[#111827]">{fmt(totalTraffic)}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Bucket filter */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[#E8EAF0] bg-white p-1">
          {buckets.map(b => (
            <button
              key={b}
              type="button"
              onClick={() => setBucketFilter(b)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                bucketFilter === b
                  ? 'bg-[#111827] text-white'
                  : 'text-[#667085] hover:bg-[#F8F9FC] hover:text-[#344054]'
              }`}
            >
              {b === 'ALL' ? 'All buckets' : b.charAt(0) + b.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#9DA4AE]">Sort by</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-[#E8EAF0] bg-white px-3 py-1.5 text-xs font-medium text-[#344054]"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-[#9DA4AE]">No competitors match the current filter.</p>
        ) : (
          filtered.map(c => <CompetitorCard key={c.domain} competitor={c} />)
        )}
      </div>
    </div>
  );
}
