'use client';

import { useMemo, useState } from 'react';

type PrimaryTopic = {
  pillar: string;
  clusterKeywords: string[];
  clusterCount: number;
  suggestedUrlPath: string | null;
  sourceMethods: string[];
};

type QueueEntry = {
  keyword: string;
  pillar: string;
  contentType: 'pillar' | 'cluster';
  suggestedUrlPath: string | null;
};

const METHOD_SHORT: Record<string, string> = {
  'method01-competitor-pages': 'M1',
  'method02-seed-expansion': 'M2',
  'method03-content-gap-import': 'M3',
  'phase1-baseline': 'B',
};

interface TopicalMapViewProps {
  primaryTopics: PrimaryTopic[];
  contentBriefQueue: QueueEntry[];
}

export function TopicalMapView({ primaryTopics, contentBriefQueue }: TopicalMapViewProps) {
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);

  const sortedTopics = useMemo(
    () => [...primaryTopics].sort((a, b) => b.clusterCount - a.clusterCount),
    [primaryTopics],
  );

  const handleJsonExport = () => {
    const data = JSON.stringify({ primaryTopics, contentBriefQueue }, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'topical-map.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Summary + export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#667085]">
          <span className="font-medium text-[#111827]">{sortedTopics.length}</span> pillars ·{' '}
          <span className="font-medium text-[#111827]">{contentBriefQueue.length}</span> keywords queued for briefs
        </p>
        <button
          type="button"
          onClick={handleJsonExport}
          className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] transition hover:bg-[#F9FAFB]"
        >
          ↓ Export JSON
        </button>
      </div>

      {/* Pillar cards */}
      <div className="space-y-2">
        {sortedTopics.map((topic) => {
          const isOpen = expandedPillar === topic.pillar;
          return (
            <div key={topic.pillar} className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedPillar(isOpen ? null : topic.pillar)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[#FAFAFB]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="truncate text-sm font-medium text-[#111827]">{topic.pillar}</span>
                  <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-medium text-[#4338CA]">
                    {topic.clusterCount} keywords
                  </span>
                  {topic.suggestedUrlPath ? (
                    <span className="hidden truncate text-xs text-[#9CA3AF] sm:block">{topic.suggestedUrlPath}</span>
                  ) : null}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {topic.sourceMethods.map((m) => (
                    <span key={m} className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#667085]">
                      {METHOD_SHORT[m] ?? m}
                    </span>
                  ))}
                  <svg
                    className={`h-4 w-4 text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-[#F3F4F6] px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {topic.clusterKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-1 text-xs text-[#344054]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Content brief queue */}
      {contentBriefQueue.length > 0 ? (
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Content brief queue</p>
          <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EAF0] bg-[#F8F9FC]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">
                    Keyword
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">
                    Pillar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">
                    Type
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#667085] sm:table-cell">
                    Suggested URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {contentBriefQueue.map((entry) => (
                  <tr key={entry.keyword} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFB]">
                    <td className="px-4 py-2.5 text-sm font-medium text-[#111827]">{entry.keyword}</td>
                    <td className="px-4 py-2.5 text-sm text-[#667085]">{entry.pillar}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          entry.contentType === 'pillar'
                            ? 'bg-[#EEF4FF] text-[#3538CD]'
                            : 'bg-[#F0FDF4] text-[#166534]'
                        }`}
                      >
                        {entry.contentType}
                      </span>
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-[#9CA3AF] sm:table-cell">
                      {entry.suggestedUrlPath ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[#E8EAF0] bg-[#F8F9FC] px-4 py-2 text-xs text-[#667085]">
              {contentBriefQueue.length} keywords queued
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
