'use client';

interface SeedKeyword {
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  category?: string;
  [key: string]: unknown;
}

interface SeedKeywordsData {
  keywords?: SeedKeyword[];
  totalCount?: number;
  categories?: string[];
  [key: string]: unknown;
}

export function SeedKeywordsRenderer({ data }: { data: unknown }) {
  const seedData = data as SeedKeywordsData;

  if (!seedData || typeof seedData !== 'object') {
    return <p className="text-sm text-zinc-500">No keyword data available.</p>;
  }

  const keywords = seedData.keywords ?? [];

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center gap-6">
        {keywords.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-zinc-100">
              {keywords.length}
            </span>
            <span className="text-sm text-zinc-500">seed keywords</span>
          </div>
        )}
        {seedData.categories && seedData.categories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-zinc-100">
              {seedData.categories.length}
            </span>
            <span className="text-sm text-zinc-500">categories</span>
          </div>
        )}
      </div>

      {/* Categories pills */}
      {seedData.categories && seedData.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {seedData.categories.map((cat, i) => (
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
      {keywords.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/70">
                <th className="px-4 py-2 text-header uppercase text-zinc-500">
                  Keyword
                </th>
                <th className="px-4 py-2 text-right text-header uppercase text-zinc-500">
                  Volume
                </th>
                <th className="px-4 py-2 text-right text-header uppercase text-zinc-500">
                  KD
                </th>
                <th className="px-4 py-2 text-header uppercase text-zinc-500">
                  Intent
                </th>
                <th className="px-4 py-2 text-header uppercase text-zinc-500">
                  Category
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {keywords.map((kw, i) => (
                <tr
                  key={i}
                  className="transition-colors hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-2 text-table text-zinc-200">
                    {kw.keyword}
                  </td>
                  <td className="px-4 py-2 text-right text-table text-zinc-400">
                    {kw.volume != null
                      ? kw.volume.toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-table">
                    {kw.difficulty != null ? (
                      <span
                        className={
                          kw.difficulty <= 30
                            ? 'text-emerald-400'
                            : kw.difficulty <= 60
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }
                      >
                        {kw.difficulty}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-table text-zinc-400">
                    {kw.intent ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-table text-zinc-400">
                    {kw.category ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
