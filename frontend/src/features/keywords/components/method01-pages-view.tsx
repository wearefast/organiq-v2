'use client';

import { useState } from 'react';

type CompetitorPage = {
  domain: string;
  url: string;
  traffic?: number | null;
  topKeyword?: string | null;
  topKeywordVolume?: number | null;
  topKeywordPosition?: number | null;
};

interface Method01PagesViewProps {
  pages: CompetitorPage[];
  country?: string | null;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function DomainAvatar({ domain }: { domain: string }) {
  const letter = domain.replace(/^www\./, '').charAt(0).toUpperCase();
  const colors: Record<string, string> = {
    A: 'bg-[#EEF4FF] text-[#3538CD]', B: 'bg-[#F0FDF4] text-[#15803D]',
    C: 'bg-[#FFF7ED] text-[#C2410C]', D: 'bg-[#FDF4FF] text-[#9333EA]',
    E: 'bg-[#F0F9FF] text-[#0284C7]', F: 'bg-[#FEF2F2] text-[#DC2626]',
    G: 'bg-[#F0FDF4] text-[#16A34A]', H: 'bg-[#FFFBEB] text-[#D97706]',
    I: 'bg-[#EEF4FF] text-[#4F46E5]', J: 'bg-[#FDF2F8] text-[#BE185D]',
    K: 'bg-[#F0FDFA] text-[#0F766E]', L: 'bg-[#FFF7ED] text-[#EA580C]',
    M: 'bg-[#EFF6FF] text-[#1D4ED8]', N: 'bg-[#F7FEE7] text-[#65A30D]',
    O: 'bg-[#FEF3C7] text-[#B45309]', P: 'bg-[#F5F3FF] text-[#7C3AED]',
    Q: 'bg-[#FFF1F2] text-[#BE123C]', R: 'bg-[#ECFDF5] text-[#059669]',
    S: 'bg-[#EFF6FF] text-[#2563EB]', T: 'bg-[#FDF4FF] text-[#A21CAF]',
    U: 'bg-[#F0F9FF] text-[#0369A1]', V: 'bg-[#F0FDF4] text-[#166534]',
    W: 'bg-[#FFFBEB] text-[#92400E]', X: 'bg-[#FEF2F2] text-[#991B1B]',
    Y: 'bg-[#FEFCE8] text-[#713F12]', Z: 'bg-[#F5F3FF] text-[#6D28D9]',
  };
  const cls = colors[letter] ?? 'bg-[#F3F4F6] text-[#374151]';
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cls}`}>
      {letter}
    </div>
  );
}

function PositionBadge({ pos }: { pos?: number | null }) {
  if (pos == null) return <span className="text-xs text-[#9CA3AF]">—</span>;
  const cls =
    pos <= 3 ? 'bg-[#ECFDF3] text-[#166534]' :
    pos <= 10 ? 'bg-[#EEF4FF] text-[#3538CD]' :
    'bg-[#F9FAFB] text-[#667085]';
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      #{pos}
    </span>
  );
}

export function Method01PagesView({ pages, country }: Method01PagesViewProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  const toggle = (domain: string) =>
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });

  // Group by domain
  const grouped = pages.reduce<Record<string, CompetitorPage[]>>((acc, page) => {
    const d = page.domain || new URL(page.url).hostname.replace(/^www\./, '');
    if (!acc[d]) acc[d] = [];
    acc[d].push(page);
    return acc;
  }, {});

  const domains = Object.keys(grouped);
  const totalTraffic = pages.reduce((s, p) => s + (p.traffic ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 divide-x divide-[#E8EAF0] rounded-xl border border-[#E8EAF0] bg-[#FCFCFD]">
        <div className="px-5 py-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-[#111827]">{pages.length}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Total pages</p>
        </div>
        <div className="px-5 py-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-[#111827]">{domains.length}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Domains</p>
        </div>
        <div className="px-5 py-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-[#111827]">{fmt(totalTraffic)}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">
            Total traffic{country ? ` · ${country.toUpperCase()}` : ''}
          </p>
        </div>
      </div>

      {/* Per-domain cards */}
      <div className="space-y-3">
        {domains.map((domain) => {
          const domainPages = grouped[domain];
          const isOpen = expandedDomains.has(domain);
          const domainTraffic = domainPages.reduce((s, p) => s + (p.traffic ?? 0), 0);

          return (
            <div key={domain} className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white">
              {/* Domain header */}
              <button
                type="button"
                onClick={() => toggle(domain)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[#F9FAFB]"
              >
                <DomainAvatar domain={domain} />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111827]">{domain}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {domainPages.length} {domainPages.length === 1 ? 'page' : 'pages'} · {fmt(domainTraffic)} traffic
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]">
                    {domainPages.length} pages
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Pages table */}
              {isOpen && (
                <div className="border-t border-[#F3F4F6]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB]">
                        <th className="px-4 py-2.5 font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">URL</th>
                        <th className="px-4 py-2.5 text-right font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Traffic</th>
                        <th className="px-4 py-2.5 font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Top keyword</th>
                        <th className="px-4 py-2.5 text-right font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Volume</th>
                        <th className="px-4 py-2.5 text-center font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Pos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F9FAFB]">
                      {domainPages.map((page, idx) => (
                        <tr key={idx} className="transition hover:bg-[#FAFAFA]">
                          <td className="max-w-[280px] px-4 py-3">
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate font-medium text-[#3538CD] hover:underline"
                              title={page.url}
                            >
                              {page.url.replace(/^https?:\/\//, '')}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#111827]">
                            {fmt(page.traffic)}
                          </td>
                          <td className="max-w-[200px] px-4 py-3">
                            <span className="block truncate text-[#374151]" title={page.topKeyword ?? ''}>
                              {page.topKeyword ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[#374151]">
                            {fmt(page.topKeywordVolume)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <PositionBadge pos={page.topKeywordPosition} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
