'use client';

import { useMemo, useState } from 'react';

export type LedgerKeyword = {
  keyword: string;
  parentTopic: string | null;
  sourceMethods: string[];
  approvalStatus: string | null;
  dedupeStatus: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  'method01-competitor-pages': 'Method 01',
  'method02-seed-expansion': 'Method 02',
  'method03-content-gap-import': 'Method 03',
  'phase1-baseline': 'Baseline',
};

const METHOD_SHORT: Record<string, string> = {
  'method01-competitor-pages': 'M1',
  'method02-seed-expansion': 'M2',
  'method03-content-gap-import': 'M3',
  'phase1-baseline': 'B',
};

interface KeywordLedgerTableProps {
  consolidatedKeywords: LedgerKeyword[];
  duplicateCount: number;
}

export function KeywordLedgerTable({ consolidatedKeywords, duplicateCount }: KeywordLedgerTableProps) {
  const [sortKey, setSortKey] = useState<'keyword' | 'parentTopic' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterMethod, setFilterMethod] = useState<string | null>(null);

  const byMethod = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kw of consolidatedKeywords) {
      for (const method of kw.sourceMethods) {
        counts[method] = (counts[method] ?? 0) + 1;
      }
    }
    return counts;
  }, [consolidatedKeywords]);

  const methods = useMemo(() => Object.keys(byMethod).sort(), [byMethod]);

  const filtered = useMemo(() => {
    let rows = consolidatedKeywords;
    if (filterMethod) rows = rows.filter((kw) => kw.sourceMethods.includes(filterMethod));
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = (sortKey === 'keyword' ? a.keyword : (a.parentTopic ?? '')) ?? '';
      const bv = (sortKey === 'keyword' ? b.keyword : (b.parentTopic ?? '')) ?? '';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [consolidatedKeywords, filterMethod, sortKey, sortDir]);

  const toggleSort = (key: 'keyword' | 'parentTopic') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleCsvDownload = () => {
    const rows = [
      ['Keyword', 'Parent Topic', 'Source Methods'],
      ...consolidatedKeywords.map((kw) => [
        kw.keyword,
        kw.parentTopic ?? '',
        kw.sourceMethods.map((m) => METHOD_SHORT[m] ?? m).join('; '),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'consolidated-keywords.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sortIcon = (key: 'keyword' | 'parentTopic') =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  return (
    <div className="mt-4 space-y-4">
      {/* Source breakdown */}
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Source breakdown</p>
          <button
            type="button"
            onClick={handleCsvDownload}
            className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] transition hover:bg-[#F9FAFB]"
          >
            ↓ Export CSV
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {methods.map((m) => (
            <div key={m} className="text-sm">
              <span className="font-medium text-[#111827]">{byMethod[m]}</span>
              <span className="ml-1.5 text-[#667085]">{METHOD_LABELS[m] ?? m}</span>
            </div>
          ))}
          {duplicateCount > 0 ? (
            <div className="text-sm">
              <span className="font-medium text-[#111827]">{duplicateCount}</span>
              <span className="ml-1.5 text-[#667085]">duplicates removed</span>
            </div>
          ) : null}
          <div className="ml-auto text-sm font-semibold text-[#111827]">{consolidatedKeywords.length} net keywords</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[#667085]">Filter:</span>
        <button
          type="button"
          onClick={() => setFilterMethod(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterMethod === null ? 'bg-[#111827] text-white' : 'border border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB]'}`}
        >
          All ({consolidatedKeywords.length})
        </button>
        {methods.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setFilterMethod(m === filterMethod ? null : m)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterMethod === m ? 'bg-[#6366F1] text-white' : 'border border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB]'}`}
          >
            {METHOD_LABELS[m] ?? m} ({byMethod[m] ?? 0})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EAF0] bg-[#F8F9FC]">
                <th className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('keyword')}
                    className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085] hover:text-[#111827]"
                  >
                    Keyword{sortIcon('keyword')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('parentTopic')}
                    className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085] hover:text-[#111827]"
                  >
                    Parent Topic{sortIcon('parentTopic')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">
                  Sources
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                    No keywords match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((kw) => (
                  <tr key={kw.keyword} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFB]">
                    <td className="px-4 py-2.5 text-sm font-medium text-[#111827]">{kw.keyword}</td>
                    <td className="px-4 py-2.5 text-sm text-[#667085]">{kw.parentTopic ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {kw.sourceMethods.map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs font-medium text-[#4338CA]"
                          >
                            {METHOD_SHORT[m] ?? m}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#E8EAF0] bg-[#F8F9FC] px-4 py-2 text-xs text-[#667085]">
          Showing {filtered.length} of {consolidatedKeywords.length} keywords
        </div>
      </div>
    </div>
  );
}
