'use client';

import { useMemo, useState } from 'react';

type GapKeyword = {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  competitorCount: number;
  competitors: string[];
  intent: string;
  funnel: string;
  contentType: string;
  parentTopic: string;
};

interface Method03TableProps {
  keywords: GapKeyword[];
}

const PAGE_SIZE = 25;

const INTENT_COLORS: Record<string, string> = {
  informational: 'bg-[#EEF4FF] text-[#3538CD]',
  commercial: 'bg-[#FFF8E5] text-[#B45309]',
  transactional: 'bg-[#ECFDF3] text-[#027A48]',
  navigational: 'bg-[#F3F4F6] text-[#374151]',
};

export function Method03Table({ keywords }: Method03TableProps) {
  const [search, setSearch] = useState('');
  const [minVolume, setMinVolume] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    const minVol = minVolume ? Number(minVolume) : null;
    return keywords.filter((kw) => {
      if (lowerSearch && !kw.keyword.toLowerCase().includes(lowerSearch) && !kw.parentTopic.toLowerCase().includes(lowerSearch)) return false;
      if (minVol !== null && (kw.volume ?? 0) < minVol) return false;
      if (intentFilter && kw.intent.toLowerCase() !== intentFilter.toLowerCase()) return false;
      return true;
    });
  }, [keywords, search, minVolume, intentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const uniqueIntents = useMemo(() => [...new Set(keywords.map((kw) => kw.intent).filter(Boolean))].sort(), [keywords]);

  const handleFilterChange = () => setPage(0);

  return (
    <div className="mt-3 space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
          placeholder="Search keywords…"
          className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
        />
        <input
          type="number"
          value={minVolume}
          onChange={(e) => { setMinVolume(e.target.value); handleFilterChange(); }}
          placeholder="Min volume"
          min={0}
          className="w-28 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
        />
        <select
          value={intentFilter}
          onChange={(e) => { setIntentFilter(e.target.value); handleFilterChange(); }}
          className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
        >
          <option value="">All intents</option>
          {uniqueIntents.map((intent) => (
            <option key={intent} value={intent}>{intent}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-[#9CA3AF]">
          {filtered.length} of {keywords.length} keywords
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#E4E7EC]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F8F9FC]">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Keyword</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Volume</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">KD</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Intent</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Funnel</th>
                <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-[#667085] sm:table-cell">Parent topic</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                    No keywords match the current filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((kw) => (
                  <tr key={kw.keyword} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFB]">
                    <td className="px-4 py-2.5 font-medium text-[#111827]">{kw.keyword}</td>
                    <td className="px-4 py-2.5 text-[#344054]">{kw.volume != null ? kw.volume.toLocaleString() : '—'}</td>
                    <td className="px-4 py-2.5 text-[#344054]">{kw.difficulty != null ? kw.difficulty : '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${INTENT_COLORS[kw.intent?.toLowerCase()] ?? 'bg-[#F3F4F6] text-[#374151]'}`}>
                        {kw.intent || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#344054]">{kw.funnel || '—'}</td>
                    <td className="hidden px-4 py-2.5 text-[#667085] sm:table-cell">{kw.parentTopic || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[#E4E7EC] bg-[#F8F9FC] px-4 py-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-[#667085]">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
