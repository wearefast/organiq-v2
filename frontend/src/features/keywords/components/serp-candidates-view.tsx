'use client';

import { useState } from 'react';

type SerpCandidate = {
  domain: string;
  occurrences: number;
  avgPosition: number;
  sampleUrls?: string[];
};

type AhrefsOrganic = {
  domain: string;
  domainRating?: number | null;
  keywordsCommon?: number | null;
  sharePercent?: number | null;
  traffic?: number | null;
};

interface SerpCandidatesViewProps {
  serpCandidates: SerpCandidate[];
  ahrefsOrganic?: AhrefsOrganic[];
}

export function SerpCandidatesView({ serpCandidates, ahrefsOrganic }: SerpCandidatesViewProps) {
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());

  const toggle = (domain: string) =>
    setOpenDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });

  if (serpCandidates.length === 0 && (!ahrefsOrganic || ahrefsOrganic.length === 0)) {
    return null;
  }

  return (
    <div className="mt-4 space-y-6">
      {serpCandidates.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.10em] text-[#667085]">
              SERP candidates
            </p>
            <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]">
              {serpCandidates.length} domains
            </span>
          </div>

          <div className="space-y-2">
            {serpCandidates.map((candidate) => {
              const isOpen = openDomains.has(candidate.domain);
              const urls = candidate.sampleUrls ?? [];

              return (
                <div
                  key={candidate.domain}
                  className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm"
                >
                  {/* Domain header row — always visible */}
                  <button
                    type="button"
                    onClick={() => toggle(candidate.domain)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAFB]"
                  >
                    {/* Chevron */}
                    <svg
                      className={`h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>

                    {/* Domain name */}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#111827]">
                      {candidate.domain}
                    </span>

                    {/* Stats — stacked label + number */}
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-center">
                        <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Avg pos</p>
                        <p className="text-sm font-bold leading-tight text-[#3538CD]">{candidate.avgPosition}</p>
                      </div>
                      <div className="h-6 w-px bg-[#E8EAF0]" />
                      <div className="text-center">
                        <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-[#9CA3AF]">Occurs</p>
                        <p className="text-sm font-bold leading-tight text-[#166534]">{candidate.occurrences}</p>
                      </div>
                    </div>
                  </button>

                  {/* Expanded: sample URLs */}
                  {isOpen ? (
                    <div className="border-t border-[#F3F4F6] px-4 py-3">
                      {urls.length > 0 ? (
                        <ul className="space-y-1.5">
                          {urls.map((url) => (
                            <li key={url}>
                              <span className="min-w-0 break-all text-xs text-[#4B5563]">{url}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-[#9CA3AF]">No sample URLs recorded.</p>
                      )}
                    </div>
                  ) : urls.length > 0 ? (
                    <div className="border-t border-[#F8F9FC] px-4 py-2">
                      <p className="truncate text-xs text-[#9CA3AF]">{urls[0]}{urls.length > 1 ? ` +${urls.length - 1} more` : ''}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {ahrefsOrganic && ahrefsOrganic.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.10em] text-[#667085]">
              Ahrefs organic
            </p>
            <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]">
              {ahrefsOrganic.length} domains
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EAF0] bg-[#F8F9FC]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Domain</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">DR</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Common KW</th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085] sm:table-cell">Traffic</th>
                </tr>
              </thead>
              <tbody>
                {ahrefsOrganic.map((c) => (
                  <tr key={c.domain} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFB]">
                    <td className="px-4 py-2.5 font-medium text-[#111827]">{c.domain}</td>
                    <td className="px-4 py-2.5 text-[#344054]">{c.domainRating ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#344054]">{c.keywordsCommon?.toLocaleString() ?? '—'}</td>
                    <td className="hidden px-4 py-2.5 text-[#344054] sm:table-cell">{c.traffic?.toLocaleString() ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
