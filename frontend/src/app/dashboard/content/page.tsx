'use client';

import { useEffect, useState } from 'react';
import {
  getContentPiece,
  getContentPieces,
  type ContentArticleInputPayload,
  type ContentBriefPayload,
  type ContentPiece,
} from '@/features/content/services/content.service';
import { StatusBadge } from '@/shared/components/status-badge';
import { Button } from '@/shared/components/button';
import { FileText, X } from 'lucide-react';

// Mock data used when API returns empty or fails
const MOCK_CONTENT = [
  { id: '1', title: 'The Complete Guide to Choosing Running Shoes in 2026', keyword: 'how to choose running shoes', pillar: 'Shoe Selection', status: 'PUBLISHED', createdAt: '2026-04-22' },
  { id: '2', title: 'Best Running Shoes for Flat Feet — Tested & Ranked', keyword: 'running shoes for flat feet', pillar: 'Shoe Selection', status: 'APPROVED', createdAt: '2026-04-28' },
  { id: '3', title: 'Marathon Training Plan: 16-Week Beginner to Sub-4', keyword: 'marathon training plan', pillar: 'Training & Plans', status: 'REVIEW', createdAt: '2026-05-01' },
  { id: '4', title: 'Carbon Plate Shoes: Are They Worth the Hype?', keyword: 'carbon plate sneakers', pillar: 'Shoe Selection', status: 'DRAFT', createdAt: '2026-05-03' },
  { id: '5', title: 'Recovery Sandals That Actually Work', keyword: 'recovery sandals', pillar: 'Injury & Recovery', status: 'BRIEF', createdAt: '2026-05-06' },
];

interface ContentRow {
  id: string;
  title: string;
  keyword?: string;
  pillar?: string;
  status: string;
  createdAt?: string;
}

interface ContentModalRow extends ContentRow {
  detail: ContentPiece | null;
  loading: boolean;
  error: boolean;
}

function toSentenceCase(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function readBrief(detail: ContentPiece | null): ContentBriefPayload {
  return detail?.brief && typeof detail.brief === 'object' ? detail.brief : {};
}

function readArticleInput(detail: ContentPiece | null): ContentArticleInputPayload {
  const reviewNotes = detail?.reviewNotes;
  if (!reviewNotes || typeof reviewNotes !== 'object') {
    return {};
  }

  const articleInput = reviewNotes.articleInput;
  return articleInput && typeof articleInput === 'object' ? articleInput : {};
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getRowKeyword(piece: ContentPiece): string {
  const brief = readBrief(piece);
  const articleInput = readArticleInput(piece);
  return typeof articleInput.targetKeyword === 'string' && articleInput.targetKeyword.trim().length > 0
    ? articleInput.targetKeyword.trim()
    : typeof brief.targetKeyword === 'string' && brief.targetKeyword.trim().length > 0
      ? brief.targetKeyword.trim()
      : '';
}

function getRowPillar(piece: ContentPiece): string {
  const brief = readBrief(piece);
  const articleInput = readArticleInput(piece);
  return typeof articleInput.pillar === 'string' && articleInput.pillar.trim().length > 0
    ? articleInput.pillar.trim()
    : typeof brief.pillar === 'string' && brief.pillar.trim().length > 0
      ? brief.pillar.trim()
      : '';
}

function formatContentDate(value?: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString();
}

function ContentPreviewModal({
  piece,
  onClose,
}: {
  piece: ContentModalRow;
  onClose: () => void;
}) {
  const isBrief = piece.status.toUpperCase() === 'BRIEF';
  const brief = readBrief(piece.detail);
  const articleInput = readArticleInput(piece.detail);
  const outline = readStringList(brief.outline);
  const targetKeywords = readStringList([
    piece.keyword,
    brief.targetKeyword,
    brief.pillar,
  ]);
  const faqs = readStringList(brief.faqs);
  const articleSections = readStringList(articleInput.articleSections);
  const draftChecklist = readStringList(articleInput.draftChecklist);
  const internalLinks = readStringList(articleInput.internalLinkTargets).length > 0
    ? readStringList(articleInput.internalLinkTargets)
    : readStringList(brief.internalLinks);
  const articleBody = typeof piece.detail?.body === 'string' ? piece.detail.body.trim() : '';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#071932]/45 px-4 py-6 backdrop-blur-sm">
      <div className="card-base relative flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden bg-[var(--canvas)] shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {isBrief ? 'Brief preview' : 'Article preview'}
            </p>
            <h2 className="mt-2 text-[24px] font-bold text-[var(--text-primary)]">{piece.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={piece.status} />
              {piece.keyword ? (
                <span className="status-brief">{piece.keyword}</span>
              ) : null}
              {piece.pillar ? (
                <span className="status-neutral">{piece.pillar}</span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-pill border border-[var(--border)] bg-[var(--canvas)] p-2 text-[var(--text-body)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {piece.loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
              ))}
            </div>
          ) : piece.error || !piece.detail ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Content preview unavailable</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">
                The persisted content payload could not be loaded for this row. Close the modal and try again.
              </p>
            </div>
          ) : isBrief ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
              <section className="space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Objective</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{typeof brief.objective === 'string' ? brief.objective : 'No objective has been stored yet.'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Audience</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{typeof brief.audience === 'string' ? brief.audience : 'No audience note has been stored yet.'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Outline</p>
                  {outline.length > 0 ? (
                    <ol className="mt-3 space-y-2 text-sm text-[var(--text-body)]">
                      {outline.map((item, index) => (
                        <li key={item} className="flex gap-3">
                          <span className="text-[var(--cc-red)]">{String(index + 1).padStart(2, '0')}</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">No outline has been stored yet.</p>
                  )}
                </div>
              </section>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Target keywords</p>
                  {targetKeywords.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {targetKeywords.map((term) => (
                        <span key={term} className="status-brief">{term}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">No target keywords are stored for this brief.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">FAQs</p>
                  {faqs.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm text-[var(--text-body)]">
                      {faqs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">No FAQs have been stored yet.</p>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <article className="mx-auto max-w-3xl space-y-6">
              <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Stored article body</p>
                <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-[var(--text-body)]">
                  {articleBody || 'The article body has not been generated or persisted yet.'}
                </p>
              </header>

              <section className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-6">
                <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">Section plan</h3>
                {articleSections.length > 0 ? (
                  <ol className="mt-3 space-y-2 text-sm leading-7 text-[var(--text-body)]">
                    {articleSections.map((section, index) => (
                      <li key={section} className="flex gap-3">
                        <span className="text-[var(--cc-red)]">{String(index + 1).padStart(2, '0')}</span>
                        <span>{section}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">No article section plan has been stored yet.</p>
                )}
              </section>

              <section className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-6">
                <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">Draft checklist</h3>
                {draftChecklist.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--text-body)]">
                    {draftChecklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">No draft checklist has been stored yet.</p>
                )}
              </section>

              <aside className="rounded-2xl border border-[var(--border)] bg-[var(--section-tint)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Editorial callout</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">
                  {typeof articleInput.recommendedAction === 'string'
                    ? articleInput.recommendedAction
                    : 'No recommended action has been stored yet.'}
                </p>
                {internalLinks.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {internalLinks.map((target) => (
                      <span key={target} className="status-neutral">{target}</span>
                    ))}
                  </div>
                ) : null}
              </aside>
            </article>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" variant="secondary">
            Edit
          </Button>
          <Button type="button">
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const [content, setContent] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPiece, setSelectedPiece] = useState<ContentModalRow | null>(null);

  useEffect(() => {
    getContentPieces()
      .then((data) => {
        if (data && data.length > 0) {
          setContent(
            data.map((piece) => ({
              id: piece.id,
              title: piece.title,
              keyword: getRowKeyword(piece),
              pillar: getRowPillar(piece),
              status: piece.status,
              createdAt: formatContentDate(piece.createdAt),
            })),
          );
        } else {
          setContent(MOCK_CONTENT);
        }
      })
      .catch(() => setContent(MOCK_CONTENT))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPiece || selectedPiece.detail || selectedPiece.error) {
      return;
    }

    let cancelled = false;

    getContentPiece(selectedPiece.id)
      .then((detail) => {
        if (cancelled) {
          return;
        }

        setSelectedPiece((current) =>
          current && current.id === selectedPiece.id
            ? {
                ...current,
                detail,
                loading: false,
                error: false,
              }
            : current,
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSelectedPiece((current) =>
          current && current.id === selectedPiece.id
            ? {
                ...current,
                loading: false,
                error: true,
              }
            : current,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPiece]);

  function openContentPreview(piece: ContentRow) {
    const isMockPiece = MOCK_CONTENT.some((mock) => mock.id === piece.id);

    setSelectedPiece({
      ...piece,
      detail: null,
      loading: !isMockPiece,
      error: false,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827]">Content</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">Briefs and articles in your editorial pipeline.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-[#F3F4F6] px-5 py-4 last:border-b-0">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-64 animate-pulse rounded bg-[#F3F4F6]" />
                  <div className="h-3 w-32 animate-pulse rounded bg-[#F3F4F6]" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-[#F3F4F6]" />
              </div>
            ))}
          </div>
        ) : content.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F9FC]">
              <FileText className="h-5 w-5 text-[#9CA3AF]" />
            </div>
            <p className="text-sm font-medium text-[#111827]">No content pieces yet</p>
            <p className="mt-1 text-sm text-[#9CA3AF]">Content will appear here as you generate briefs and articles from your keyword workflows.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6] bg-[#FAFAFB]">
                <th className="table-header-cell px-5 py-3">Title</th>
                <th className="table-header-cell px-5 py-3">Keyword</th>
                <th className="table-header-cell px-5 py-3">Pillar</th>
                <th className="table-header-cell px-5 py-3">Status</th>
                <th className="table-header-cell px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {content.map((piece) => (
                <tr
                  key={piece.id}
                  className="cursor-pointer border-b border-[#F3F4F6] transition-colors last:border-b-0 hover:bg-[#FAFAFB] focus-within:bg-[#FAFAFB]"
                  onClick={() => openContentPreview(piece)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openContentPreview(piece);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="px-5 py-3.5 font-medium text-[#111827]">{piece.title}</td>
                  <td className="px-5 py-3.5 text-[#4B5563]">{piece.keyword || '—'}</td>
                  <td className="px-5 py-3.5 text-[#4B5563]">{piece.pillar || '—'}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={piece.status} />
                  </td>
                  <td className="px-5 py-3.5 text-[#9CA3AF]">{piece.createdAt || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedPiece ? <ContentPreviewModal piece={selectedPiece} onClose={() => setSelectedPiece(null)} /> : null}
    </div>
  );
}
