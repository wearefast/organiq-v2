'use client';

import { useEffect, useRef, useState } from 'react';

type ContentPiece = {
  id: string;
  keywordId: string;
  title: string;
  status: 'BRIEF' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  body: string | null;
  brief: Record<string, unknown> | null;
  reviewNotes: Record<string, unknown> | null;
  language: string;
  country: string | null;
  createdAt: string;
};

type Props = {
  initialPiece: ContentPiece;
  keyword: string | null;
  pillar: string;
  suggestedUrlPath: string | null;
  articleSectionCount: number;
  workflowCountry: string;
  apiUrl: string;
};

const POLL_INTERVAL_MS = 4000;
const GENERATING_STATUSES = new Set(['DRAFT']);

export function ContentPieceStatusCard({
  initialPiece,
  keyword,
  pillar,
  suggestedUrlPath,
  articleSectionCount,
  workflowCountry,
  apiUrl,
}: Props) {
  const [piece, setPiece] = useState(initialPiece);
  const [isPolling, setIsPolling] = useState(
    () => GENERATING_STATUSES.has(initialPiece.status) && initialPiece.body === null,
  );
  const [articleExpanded, setArticleExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPolling) return;

    const poll = async () => {
      try {
        const res = await fetch(`${apiUrl}/content/${piece.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const updated: ContentPiece = await res.json();
        setPiece(updated);
        if (!GENERATING_STATUSES.has(updated.status) || updated.body !== null) {
          setIsPolling(false);
          return;
        }
      } catch {
        // network error — keep polling
      }
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPolling, piece.id, apiUrl]);

  const isGenerating = isPolling || (GENERATING_STATUSES.has(piece.status) && piece.body === null);
  const isPublished = piece.status === 'PUBLISHED' && piece.body !== null;
  const reviewNotes = piece.reviewNotes as Record<string, unknown> | null;
  const articleInput = reviewNotes?.articleInput as Record<string, unknown> | null;

  return (
    <article className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#111827]">{piece.title}</h3>
          <p className="mt-1 text-sm text-[#667085]">{keyword ?? `Keyword ID ${piece.keywordId}`}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isGenerating ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#FEF6EE] px-3 py-1 text-xs font-medium text-[#B54708]">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#B54708] border-t-transparent" />
              Generating…
            </span>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isPublished
                  ? 'bg-[#ECFDF3] text-[#027A48]'
                  : 'bg-[#EEF4FF] text-[#3538CD]'
              }`}
            >
              {piece.status}
            </span>
          )}
          <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
            {piece.language.toUpperCase()} / {(piece.country ?? workflowCountry).toUpperCase()}
          </span>
          <span className="rounded-full bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#667085]">
            {articleInput ? 'Article input saved' : 'Brief saved'}
          </span>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#E4E7EC] bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Pillar</p>
          <p className="mt-2 text-sm font-medium text-[#111827]">{pillar}</p>
          {suggestedUrlPath ? <p className="mt-1 text-xs text-[#667085]">{suggestedUrlPath}</p> : null}
        </div>

        <div className="rounded-lg border border-[#E4E7EC] bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">Draft readiness</p>
          {isGenerating ? (
            <p className="mt-2 text-sm font-medium text-[#B54708]">Article generation in progress…</p>
          ) : isPublished ? (
            <p className="mt-2 text-sm font-medium text-[#027A48]">Article generated</p>
          ) : (
            <p className="mt-2 text-sm font-medium text-[#111827]">
              {articleInput
                ? `${articleSectionCount} planned section${articleSectionCount === 1 ? '' : 's'} persisted`
                : 'Awaiting approved article input'}
            </p>
          )}
          <p className="mt-1 text-xs text-[#667085]">
            Saved {new Date(piece.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Generating spinner banner */}
      {isGenerating ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#FEE4C8] bg-[#FFF6ED] px-4 py-3">
          <span className="inline-block h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-[#B54708] border-t-transparent" />
          <p className="text-sm text-[#B54708]">
            Article is being generated by AI. This usually takes 20–40 seconds. This page will update automatically.
          </p>
        </div>
      ) : null}

      {/* Article body */}
      {isPublished ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setArticleExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-[#E4E7EC] bg-white px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-[#111827]">
              Generated article ({piece.body!.length.toLocaleString()} chars)
            </span>
            <span className="text-xs text-[#667085]">{articleExpanded ? 'Collapse ↑' : 'Expand ↓'}</span>
          </button>

          {articleExpanded ? (
            <div className="mt-2 max-h-[600px] overflow-y-auto rounded-lg border border-[#E4E7EC] bg-white p-4">
              <pre className="whitespace-pre-wrap text-sm text-[#111827] font-sans leading-relaxed">
                {piece.body}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
