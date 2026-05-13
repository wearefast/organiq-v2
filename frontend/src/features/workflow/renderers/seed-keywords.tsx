'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

interface SeedKeyword {
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  category?: string;
  source?: string;
  relevanceScore?: number;
  notes?: string | null;
  [key: string]: unknown;
}

interface SeedKeywordsData {
  keywords?: SeedKeyword[];
  seedKeywords?: SeedKeyword[];
  totalCount?: number;
  categories?: string[] | Record<string, unknown>;
  [key: string]: unknown;
}

export function SeedKeywordsRenderer({ data }: { data: unknown }) {
  const seedData = data as SeedKeywordsData;

  if (!seedData || typeof seedData !== 'object') {
    return <p className="text-sm text-zinc-500">No keyword data available.</p>;
  }

  // Support both "keywords" and "seedKeywords" keys
  const keywords = seedData.keywords ?? seedData.seedKeywords ?? [];

  // Categories can be string[] or Record<string, string[]>
  const categoryNames: string[] = Array.isArray(seedData.categories)
    ? seedData.categories
    : seedData.categories && typeof seedData.categories === 'object'
      ? Object.keys(seedData.categories)
      : [];

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center gap-6">
        {keywords.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-zinc-100">
              {keywords.length}
            </span>
            <InfoTip tip="Initial keywords used to discover your niche"><span className="text-sm text-zinc-500">seed keywords</span></InfoTip>
          </div>
        )}
        {categoryNames.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-zinc-100">
              {categoryNames.length}
            </span>
            <InfoTip tip="Distinct keyword groupings by topic"><span className="text-sm text-zinc-500">categories</span></InfoTip>
          </div>
        )}
      </div>

      {/* Categories pills */}
      {categoryNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryNames.map((cat, i) => (
            <span
              key={i}
              className="rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-400"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Keywords table */}
      {keywords.length > 0 && <SortableSeedKeywordsTable keywords={keywords} />}
    </div>
  );
}

function SortableSeedKeywordsTable({ keywords }: { keywords: SeedKeyword[] }) {
  type SK = 'keyword' | 'volume' | 'difficulty' | 'intent' | 'category';
  const [sortKey, setSortKey] = useState<SK>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'keyword' || key === 'intent' || key === 'category' ? 'asc' : 'desc'); }
  };

  const sorted = [...keywords].sort((a, b) => {
    const va = a[sortKey] as string | number | undefined;
    const vb = b[sortKey] as string | number | undefined;
    const cmp = typeof va === 'string' ? (va ?? '').localeCompare((vb as string) ?? '') : (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (align: string) => `cursor-pointer select-none px-4 py-2 text-header uppercase text-zinc-500 hover:text-zinc-300 ${align}`;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/70">
            <th className={th('')} onClick={() => handleSort('keyword')}><InfoTip tip="Search term you're targeting">Keyword{arrow('keyword')}</InfoTip></th>
            <th className={th('text-right')} onClick={() => handleSort('volume')}><InfoTip tip="Estimated monthly searches">Volume{arrow('volume')}</InfoTip></th>
            <th className={th('text-right')} onClick={() => handleSort('difficulty')}><InfoTip tip="Keyword Difficulty (0–100). Lower = easier to rank">KD{arrow('difficulty')}</InfoTip></th>
            <th className={th('')} onClick={() => handleSort('intent')}><InfoTip tip="User search intent (informational, commercial, etc.)">Intent{arrow('intent')}</InfoTip></th>
            <th className={th('')} onClick={() => handleSort('category')}><InfoTip tip="Topic classification for this keyword">Category{arrow('category')}</InfoTip></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {sorted.map((kw, i) => (
            <tr key={i} className="transition-colors hover:bg-zinc-800/30">
              <td className="px-4 py-2 text-table text-zinc-200">{kw.keyword}</td>
              <td className="px-4 py-2 text-right text-table text-zinc-400">
                {kw.volume != null ? kw.volume.toLocaleString() : '—'}
              </td>
              <td className="px-4 py-2 text-right text-table">
                {kw.difficulty != null ? (
                  <span className={kw.difficulty <= 30 ? 'text-emerald-400' : kw.difficulty <= 60 ? 'text-amber-400' : 'text-red-400'}>
                    {kw.difficulty}
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-table text-zinc-400">{kw.intent ?? '—'}</td>
              <td className="px-4 py-2 text-table text-zinc-400">{kw.category ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
