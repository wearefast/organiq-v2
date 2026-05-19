'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { MarkdownPreview } from '@/shared/components/markdown-preview';
import { setAuthToken } from '@/shared/utils/api';
import {
  fetchContent,
  fetchContentStats,
  fetchContentImages,
  updateContentStatus,
  type ContentPiece,
  type ContentStats,
  type ContentImage,
} from '@/features/content/services/content.service';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-600',
  review: 'bg-yellow-600',
  approved: 'bg-green-600',
  published: 'bg-blue-600',
};

const TYPE_LABELS: Record<string, string> = {
  brief: 'Brief',
  article: 'Article',
};

function ScoreBar({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const color =
    value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const h = size === 'lg' ? 'h-3' : 'h-1.5';
  return (
    <div className={`flex-1 ${h} rounded-full bg-zinc-700`}>
      <div className={`${h} rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export default function ContentPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { getToken } = useAuth();

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'brief' | 'article'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      setAuthToken(await getToken());
      const [piecesData, statsData] = await Promise.all([
        fetchContent(projectId),
        fetchContentStats(projectId),
      ]);
      setPieces(piecesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: ContentPiece['status']) {
    try {
      setAuthToken(await getToken());
      const updated = await updateContentStatus(projectId, id, status);
      setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      setStats((prev) =>
        prev ? { ...prev } : prev, // will reload cleanly
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  const filtered = pieces.filter((p) => {
    if (filter !== 'all' && p.type !== filter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const selected = selectedId ? pieces.find((p) => p.id === selectedId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Content</h1>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-400">Total Pieces</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-400">Briefs</p>
            <p className="text-2xl font-bold text-white">{stats.byType.brief}</p>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-400">Articles</p>
            <p className="text-2xl font-bold text-white">{stats.byType.article}</p>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-sm text-zinc-400">Total Words</p>
            <p className="text-2xl font-bold text-white">
              {stats.totalWordCount.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Status Pipeline */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          {(['draft', 'review', 'approved', 'published'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={`rounded-lg border p-3 text-center transition ${
                statusFilter === s
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
              }`}
            >
              <p className="text-lg font-bold text-white">{stats.byStatus[s]}</p>
              <p className="text-xs capitalize text-zinc-400">{s}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'brief', 'article'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {f === 'all' ? 'All' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Content List + Detail Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* List */}
        <div className={`space-y-2 ${selected ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-8 text-center">
              <p className="text-zinc-400">No content pieces yet.</p>
              <p className="mt-1 text-xs text-zinc-500">
                Run a workflow to generate content briefs and articles.
              </p>
            </div>
          ) : (
            filtered.map((piece) => (
              <button
                key={piece.id}
                onClick={() => setSelectedId(piece.id === selectedId ? null : piece.id)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  piece.id === selectedId
                    ? 'border-blue-500 bg-blue-900/10'
                    : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{piece.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                      {TYPE_LABELS[piece.type]}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs text-white ${STATUS_COLORS[piece.status]}`}
                    >
                      {piece.status}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                  {piece.wordCount && <span>{piece.wordCount.toLocaleString()} words</span>}
                  <span>{new Date(piece.createdAt).toLocaleDateString()}</span>
                </div>
                {/* Score mini-bars */}
                {piece.scores && (
                  <div className="mt-2 flex gap-2">
                    {piece.scores.overall !== undefined && (
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[10px] text-zinc-500 w-8">Score</span>
                        <ScoreBar value={piece.scores.overall} />
                        <span className="text-[10px] text-zinc-400 w-6 text-right">
                          {piece.scores.overall}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-zinc-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                  {TYPE_LABELS[selected.type]}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs text-white ${STATUS_COLORS[selected.status]}`}
                >
                  {selected.status}
                </span>
                {selected.wordCount && (
                  <span className="text-xs text-zinc-500">
                    {selected.wordCount.toLocaleString()} words
                  </span>
                )}
              </div>

              {/* Status actions */}
              <div className="mt-4 flex gap-2">
                {selected.status === 'draft' && (
                  <button
                    onClick={() => handleStatusChange(selected.id, 'review')}
                    className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500"
                  >
                    Send to Review
                  </button>
                )}
                {selected.status === 'review' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(selected.id, 'approved')}
                      className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange(selected.id, 'draft')}
                      className="rounded bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-500"
                    >
                      Back to Draft
                    </button>
                  </>
                )}
                {selected.status === 'approved' && (
                  <button
                    onClick={() => handleStatusChange(selected.id, 'published')}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    Mark Published
                  </button>
                )}
              </div>
            </div>

            {/* Score Dashboard */}
            {selected.scores ? (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
                <h3 className="text-sm font-medium text-zinc-400">Content Scores</h3>
                {([
                  ['Readability', selected.scores.readability],
                  ['SEO Quality', selected.scores.seo_quality],
                  ['AI Citability', selected.scores.citability],
                  ['Content Length', selected.scores.content_length],
                  ['Overall', selected.scores.overall],
                ] as [string, number | undefined][])
                  .filter((entry): entry is [string, number] => entry[1] !== undefined)
                  .map(([label, value]) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-28 text-xs text-zinc-400">{label}</span>
                        <ScoreBar value={value} size="lg" />
                        <span className="w-8 text-right text-sm font-medium text-zinc-300">
                          {value}
                        </span>
                      </div>
                    ),
                )}
              </div>
            ) : null}

            {/* Brief Data Preview */}
            {selected.briefData ? (
              <BriefDataPanel briefData={selected.briefData} />
            ) : null}

            {/* Article Data Preview */}
            {selected.articleData ? (
              <ArticleDataPanel
                articleData={selected.articleData}
                projectId={projectId}
                contentPieceId={selected.id}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Brief Data Structured Panel ───────────────────────────────── */
function BriefDataPanel({ briefData }: { briefData: unknown }) {
  const d = briefData && typeof briefData === 'object' ? (briefData as Record<string, unknown>) : {};
  const targetKeyword = typeof d.targetKeyword === 'string' ? d.targetKeyword : null;
  const metaTitle = typeof d.metaTitle === 'string' ? d.metaTitle : null;
  const metaDescription = typeof d.metaDescription === 'string' ? d.metaDescription : null;
  const searchIntent = typeof d.searchIntent === 'string' ? d.searchIntent : null;
  const wordCountTarget = typeof d.wordCountTarget === 'number' ? d.wordCountTarget : null;
  const paaQuestions = Array.isArray(d.paaQuestions) ? d.paaQuestions.filter((q): q is string => typeof q === 'string') : [];
  const secondaryKeywords = Array.isArray(d.secondaryKeywords) ? d.secondaryKeywords.filter((k): k is string => typeof k === 'string') : [];
  const summary = typeof d.summary === 'string' ? d.summary : null;
  const contentStructure = d.contentStructure;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-4">
      <h3 className="text-sm font-medium text-zinc-400">Content Brief</h3>

      {/* Key info row */}
      <div className="flex flex-wrap gap-2">
        {targetKeyword && (
          <span className="rounded bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">
            🎯 {targetKeyword}
          </span>
        )}
        {searchIntent && (
          <span className="rounded bg-purple-900/40 px-2 py-0.5 text-xs text-purple-300">
            {searchIntent}
          </span>
        )}
        {wordCountTarget && (
          <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            Target: {wordCountTarget.toLocaleString()} words
          </span>
        )}
      </div>

      {/* Meta */}
      {(metaTitle || metaDescription) && (
        <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3 space-y-1">
          {metaTitle && <p className="text-sm font-medium text-green-400">{metaTitle}</p>}
          {metaDescription && <p className="text-xs text-zinc-400 leading-5">{metaDescription}</p>}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Summary</p>
          <p className="mt-1 text-sm leading-6 text-zinc-300">{summary}</p>
        </div>
      )}

      {/* Content Structure */}
      {(contentStructure && typeof contentStructure === 'object') ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Content Structure</p>
          <div className="mt-1 max-h-48 overflow-y-auto text-xs text-zinc-400">
            <MarkdownPreview
              content={typeof contentStructure === 'string' ? contentStructure : JSON.stringify(contentStructure, null, 2)}
            />
          </div>
        </div>
      ) : null}

      {/* Secondary Keywords */}
      {secondaryKeywords.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Secondary Keywords</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {secondaryKeywords.map((kw) => (
              <span key={kw} className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* PAA Questions */}
      {paaQuestions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">People Also Ask</p>
          <ul className="mt-1 space-y-1">
            {paaQuestions.map((q) => (
              <li key={q} className="text-xs text-zinc-300 leading-5">• {q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Article Content Panel with Markdown ───────────────────────── */
function ArticleDataPanel({
  articleData,
  projectId,
  contentPieceId,
}: {
  articleData: unknown;
  projectId: string;
  contentPieceId: string;
}) {
  const d = articleData && typeof articleData === 'object' ? (articleData as Record<string, unknown>) : {};
  const rawContent = typeof d.content === 'string' ? d.content : null;
  const metaTitle = typeof d.metaTitle === 'string' ? d.metaTitle : null;
  const metaDescription = typeof d.metaDescription === 'string' ? d.metaDescription : null;
  const keyTakeaways = Array.isArray(d.keyTakeaways) ? d.keyTakeaways.filter((t): t is string => typeof t === 'string') : [];

  const [images, setImages] = useState<ContentImage[]>([]);

  useEffect(() => {
    if (!projectId || !contentPieceId) return;
    fetchContentImages(projectId, contentPieceId)
      .then(setImages)
      .catch(() => {});
  }, [projectId, contentPieceId]);

  // Build imageMap: { 'image-0': 'data:image/png;base64,...', ... }
  const imageMap = images.length
    ? Object.fromEntries(
        images
          .filter((img) => img.base64)
          .map((img) => [`image-${img.index}`, `data:image/png;base64,${img.base64}`]),
      )
    : undefined;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-4">
      <h3 className="text-sm font-medium text-zinc-400">Article Content</h3>

      {/* Meta preview */}
      {(metaTitle || metaDescription) && (
        <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3 space-y-1">
          {metaTitle && <p className="text-sm font-medium text-green-400">{metaTitle}</p>}
          {metaDescription && <p className="text-xs text-zinc-400 leading-5">{metaDescription}</p>}
        </div>
      )}

      {/* Key Takeaways */}
      {keyTakeaways.length > 0 && (
        <div className="rounded border border-zinc-700 bg-zinc-900/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Key Takeaways</p>
          <ul className="space-y-1">
            {keyTakeaways.map((t) => (
              <li key={t} className="text-xs text-zinc-300 leading-5">✓ {t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Markdown body with inline images */}
      {rawContent ? (
        <div className="max-h-[56rem] overflow-y-auto">
          <MarkdownPreview content={rawContent} imageMap={imageMap} />
        </div>
      ) : (
        <pre className="max-h-64 overflow-y-auto text-xs text-zinc-300">
          {JSON.stringify(articleData, null, 2)}
        </pre>
      )}
    </div>
  );
}


