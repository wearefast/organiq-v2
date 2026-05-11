'use client';

import { useEffect, useState } from 'react';
import { getContentPieces } from '@/features/content/services/content.service';
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

type BriefPreview = {
  objective: string;
  audience: string;
  outline: string[];
  faqs: string[];
  targetKeywords: string[];
};

type ArticlePreview = {
  intro: string;
  sections: Array<{ heading: string; body: string }>;
  callout: string;
};

function toSentenceCase(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function buildBriefPreview(piece: ContentRow): BriefPreview {
  const keyword = piece.keyword || piece.title.toLowerCase();
  const pillar = piece.pillar || 'Growth Strategy';

  return {
    objective: `Create a strategist-ready brief for ${keyword} that can rank while matching ${pillar.toLowerCase()} intent.`,
    audience: `Commercial researchers evaluating ${keyword} solutions and comparing providers before a shortlist.`,
    outline: [
      `Explain the market context around ${keyword}`,
      `Compare the main decision factors and trade-offs`,
      `Outline recommended product or service paths`,
      `Close with a clear next-step CTA tied to ${pillar}`,
    ],
    faqs: [
      `How competitive is ${keyword}?`,
      `What content angle wins for ${keyword}?`,
      `Which internal links should support this page?`,
    ],
    targetKeywords: [keyword, pillar, `${keyword} guide`],
  };
}

function buildArticlePreview(piece: ContentRow): ArticlePreview {
  const keyword = piece.keyword || piece.title.toLowerCase();
  const pillar = piece.pillar || 'Growth Strategy';

  return {
    intro: `${piece.title} is positioned as a practical editorial piece for ${pillar.toLowerCase()} readers who need a clear recommendation path, not generic commentary.`,
    sections: [
      {
        heading: `What matters most for ${keyword}`,
        body: `Open with the high-intent decision criteria, align them to business context, and frame the reader problem in commercial language rather than informational filler.`,
      },
      {
        heading: 'How to evaluate the options',
        body: `Move into a structured comparison section with trust signals, selection criteria, and a clear explanation of when each path makes sense.`,
      },
      {
        heading: 'Recommended next step',
        body: `Close with an outcome-focused recommendation that bridges the article into conversion, internal linking, and follow-up content.`,
      },
    ],
    callout: `Editorial note: keep the voice confident, strategic, and conversion-focused. Anchor examples to ${pillar.toLowerCase()} workflows.`,
  };
}

function ContentPreviewModal({
  piece,
  onClose,
}: {
  piece: ContentRow;
  onClose: () => void;
}) {
  const isBrief = piece.status.toUpperCase() === 'BRIEF';
  const brief = buildBriefPreview(piece);
  const article = buildArticlePreview(piece);

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
          {isBrief ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
              <section className="space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Objective</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{brief.objective}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Audience</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{brief.audience}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Outline</p>
                  <ol className="mt-3 space-y-2 text-sm text-[var(--text-body)]">
                    {brief.outline.map((item, index) => (
                      <li key={item} className="flex gap-3">
                        <span className="text-[var(--cc-red)]">{String(index + 1).padStart(2, '0')}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Target keywords</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {brief.targetKeywords.map((term) => (
                      <span key={term} className="status-brief">{term}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">FAQs</p>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--text-body)]">
                    {brief.faqs.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          ) : (
            <article className="mx-auto max-w-3xl space-y-6">
              <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Draft intro</p>
                <p className="mt-3 text-base leading-7 text-[var(--text-body)]">{article.intro}</p>
              </header>

              {article.sections.map((section) => (
                <section key={section.heading} className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-6">
                  <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">{section.heading}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-body)]">{section.body}</p>
                </section>
              ))}

              <aside className="rounded-2xl border border-[var(--border)] bg-[var(--section-tint)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Editorial callout</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{article.callout}</p>
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
  const [selectedPiece, setSelectedPiece] = useState<ContentRow | null>(null);

  useEffect(() => {
    getContentPieces()
      .then((data) => {
        if (data && data.length > 0) {
          setContent(data.map((d) => ({ ...d, keyword: '', pillar: '', createdAt: '' })));
        } else {
          setContent(MOCK_CONTENT);
        }
      })
      .catch(() => setContent(MOCK_CONTENT))
      .finally(() => setLoading(false));
  }, []);

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
                  onClick={() => setSelectedPiece(piece)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedPiece(piece);
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
