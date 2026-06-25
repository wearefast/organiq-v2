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
import { ContentArticleRenderer } from '@/features/workflow/renderers/content-article';
import { useContentStep } from '@/features/content/hooks/use-content-step';

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
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const h = size === 'lg' ? 'h-3' : 'h-1.5';
  return (
    <div className={`flex-1 ${h} rounded-full bg-zinc-700`}>
      <div className={`${h} rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export default function ArticlesPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { getToken } = useAuth();

  const {
    stepStatus: articleStepStatus,
    artifactData: articleArtifact,
    loading: stepLoading,
    approving,
    approve,
  } = useContentStep(projectId, 'content-article');

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'brief' | 'article'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [projectId]);

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

  if (stepLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
      </div>
    );
  }

  // Article awaiting approval: full-page review before materialising into domain table
  if (articleStepStatus === 'awaiting_approval') {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">Your article is ready for review</p>
              <p className="text-xs text-zinc-500">
                Review the article below, then approve to finalise it and begin image generation.
              </p>
            </div>
          </div>
          <button
            onClick={approve}
            disabled={approving}
            className="shrink-0 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {approving ? 'Approving…' : 'Approve & Continue →'}
          </button>
        </div>
        <ContentArticleRenderer data={articleArtifact} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {articleStepStatus === 'running' && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-blue-300">Writing your article…</p>
            <p className="text-xs text-zinc-500">This usually takes 2–3 minutes. This page will update automatically.</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Articles</h1>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Total Pieces', value: stats.total },
            { label: 'Briefs', value: stats.byType.brief },
            { label: 'Articles', value: stats.byType.article },
            { label: 'Total Words', value: stats.totalWordCount.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <p className="text-sm text-zinc-400">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
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

      {/* Type filter */}
      <div className="flex gap-2">
        {(['all', 'brief', 'article'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              filter === f ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {f === 'all' ? 'All' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Content List + Detail Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div data-tour="articles-list" className={`space-y-2 ${selected ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-8 text-center">
              <p className="text-zinc-400">No content pieces yet.</p>
              <p className="mt-1 text-xs text-zinc-500">Run a workflow to generate content briefs and articles.</p>
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
                    <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">{TYPE_LABELS[piece.type]}</span>
                    <span className={`rounded px-2 py-0.5 text-xs text-white ${STATUS_COLORS[piece.status]}`}>{piece.status}</span>
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                  {piece.wordCount && <span>{piece.wordCount.toLocaleString()} words</span>}
                  <span>{new Date(piece.createdAt).toLocaleDateString()}</span>
                </div>
                {piece.scores?.overall !== undefined && (
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] text-zinc-500 w-8">Score</span>
                    <ScoreBar value={piece.scores.overall} />
                    <span className="text-[10px] text-zinc-400 w-6 text-right">{piece.scores.overall}</span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="lg:col-span-3 space-y-4">
            <DetailPanel
              piece={selected}
              projectId={projectId}
              onClose={() => setSelectedId(null)}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Detail panel ─────────────────────────────────────────── */

function DetailPanel({
  piece,
  projectId,
  onClose,
  onStatusChange,
}: {
  piece: ContentPiece;
  projectId: string;
  onClose: () => void;
  onStatusChange: (id: string, status: ContentPiece['status']) => void;
}) {
  return (
    <>
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{piece.title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm">✕</button>
        </div>
        <div className="mt-2 flex gap-2">
          <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">{TYPE_LABELS[piece.type]}</span>
          <span className={`rounded px-2 py-0.5 text-xs text-white ${STATUS_COLORS[piece.status]}`}>{piece.status}</span>
          {piece.wordCount && <span className="text-xs text-zinc-500">{piece.wordCount.toLocaleString()} words</span>}
        </div>
        <div className="mt-4 flex gap-2">
          {piece.status === 'draft' && (
            <button onClick={() => onStatusChange(piece.id, 'review')} className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500">Send to Review</button>
          )}
          {piece.status === 'review' && (
            <>
              <button onClick={() => onStatusChange(piece.id, 'approved')} className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500">Approve</button>
              <button onClick={() => onStatusChange(piece.id, 'draft')} className="rounded bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-500">Back to Draft</button>
            </>
          )}
          {piece.status === 'approved' && (
            <button onClick={() => onStatusChange(piece.id, 'published')} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500">Mark Published</button>
          )}
        </div>
      </div>

      {piece.scores && <ScorePanel scores={piece.scores} />}
      {piece.briefData && <BriefDataPanel briefData={piece.briefData} />}
      {piece.articleData && <ArticleDataPanel articleData={piece.articleData} projectId={projectId} contentPieceId={piece.id} />}
    </>
  );
}

/* ── Score panel ──────────────────────────────────────────── */

function ScorePanel({ scores }: { scores: NonNullable<ContentPiece['scores']> }) {
  const rows: [string, number | undefined][] = [
    ['Readability', scores.readability],
    ['SEO Quality', scores.seo_quality],
    ['AI Citability', scores.citability],
    ['Content Length', scores.content_length],
    ['Overall', scores.overall],
  ];
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-400">Content Scores</h3>
      {rows.filter((r): r is [string, number] => r[1] !== undefined).map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-28 text-xs text-zinc-400">{label}</span>
          <ScoreBar value={value} size="lg" />
          <span className="w-8 text-right text-sm font-medium text-zinc-300">{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Brief data panel ─────────────────────────────────────── */

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

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-4">
      <h3 className="text-sm font-medium text-zinc-400">Content Brief</h3>
      <div className="flex flex-wrap gap-2">
        {targetKeyword && <span className="rounded bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">🎯 {targetKeyword}</span>}
        {searchIntent && <span className="rounded bg-purple-900/40 px-2 py-0.5 text-xs text-purple-300">{searchIntent}</span>}
        {wordCountTarget && <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">Target: {wordCountTarget.toLocaleString()} words</span>}
      </div>
      {(metaTitle || metaDescription) && (
        <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3 space-y-1">
          {metaTitle && <p className="text-sm font-medium text-green-400">{metaTitle}</p>}
          {metaDescription && <p className="text-xs text-zinc-400 leading-5">{metaDescription}</p>}
        </div>
      )}
      {summary && <p className="text-sm leading-6 text-zinc-300">{summary}</p>}
      {secondaryKeywords.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Secondary Keywords</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {secondaryKeywords.map((kw) => <span key={kw} className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{kw}</span>)}
          </div>
        </div>
      )}
      {paaQuestions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">People Also Ask</p>
          <ul className="mt-1 space-y-1">{paaQuestions.map((q) => <li key={q} className="text-xs text-zinc-300 leading-5">• {q}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/* ── Article data panel ───────────────────────────────────── */

function ArticleDataPanel({ articleData, projectId, contentPieceId }: { articleData: unknown; projectId: string; contentPieceId: string }) {
  const d = articleData && typeof articleData === 'object' ? (articleData as Record<string, unknown>) : {};
  const rawContent = typeof d.content === 'string' ? d.content : null;
  const metaTitle = typeof d.metaTitle === 'string' ? d.metaTitle : null;
  const metaDescription = typeof d.metaDescription === 'string' ? d.metaDescription : null;
  const keyTakeaways = Array.isArray(d.keyTakeaways) ? d.keyTakeaways.filter((t): t is string => typeof t === 'string') : [];
  const [images, setImages] = useState<ContentImage[]>([]);

  useEffect(() => {
    fetchContentImages(projectId, contentPieceId).then(setImages).catch(() => {});
  }, [projectId, contentPieceId]);

  const imageMap = images.length
    ? Object.fromEntries(images.filter((i) => i.base64).map((i) => [`image-${i.index}`, `data:image/png;base64,${i.base64}`]))
    : undefined;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-4">
      <h3 className="text-sm font-medium text-zinc-400">Article Content</h3>
      {(metaTitle || metaDescription) && (
        <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3 space-y-1">
          {metaTitle && <p className="text-sm font-medium text-green-400">{metaTitle}</p>}
          {metaDescription && <p className="text-xs text-zinc-400 leading-5">{metaDescription}</p>}
        </div>
      )}
      {keyTakeaways.length > 0 && (
        <div className="rounded border border-zinc-700 bg-zinc-900/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Key Takeaways</p>
          <ul className="space-y-1">{keyTakeaways.map((t) => <li key={t} className="text-xs text-zinc-300 leading-5">✓ {t}</li>)}</ul>
        </div>
      )}
      {rawContent ? (
        <div className="max-h-[56rem] overflow-y-auto">
          <MarkdownPreview content={rawContent} imageMap={imageMap} />
        </div>
      ) : (
        <pre className="max-h-64 overflow-y-auto text-xs text-zinc-300">{JSON.stringify(articleData, null, 2)}</pre>
      )}
    </div>
  );
}
