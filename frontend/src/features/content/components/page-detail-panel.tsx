'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X, FileText, BookOpen, Image, Globe, Loader2,
  CheckCircle2, Clock, ChevronDown, RotateCcw, Pencil, Check, Plus, Trash2,
} from 'lucide-react';
import {
  fetchTopicalMapPage,
  generateBriefForPage,
  generateArticleForPage,
  syncTopicalMapPages,
  updateContentPiece,
  updateContentStatus,
  deleteContentPiece,
  type TopicalMapPageDetail,
  type ContentPiece,
  type ContentImage,
} from '@/features/content/services/content.service';

interface PageDetailPanelProps {
  projectId: string;
  mapId: string;
  pageId: string;
  onClose: () => void;
  onContentGenerated?: () => void;
}

type BusyState = 'idle' | 'generating-brief' | 'generating-article' | 'approving' | 'regenerating' | 'saving';
type ContentPieceWithImages = ContentPiece & { images?: ContentImage[] };

// ─── Brief edit model ─────────────────────────────────────────────────────

interface OutlineSection { heading: string; type: string; notes: string; wordCount: string }

interface BriefEditState {
  title: string;
  metaDescription: string;
  targetKeyword: string;
  secondaryKeywords: string;
  targetWordCount: string;
  contentType: string;
  tone: string;
  funnelStage: string;
  intent: string;
  callToAction: string;
  keyPoints: string;
  outline: OutlineSection[];
}

function briefToEditState(data: unknown): BriefEditState {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    title: String(d.title ?? ''),
    metaDescription: String(d.metaDescription ?? ''),
    targetKeyword: String(d.targetKeyword ?? ''),
    secondaryKeywords: Array.isArray(d.secondaryKeywords) ? (d.secondaryKeywords as string[]).join('\n') : '',
    targetWordCount: String(d.targetWordCount ?? ''),
    contentType: String(d.contentType ?? ''),
    tone: String(d.tone ?? ''),
    funnelStage: String(d.funnelStage ?? ''),
    intent: String(d.intent ?? ''),
    callToAction: String(d.callToAction ?? ''),
    keyPoints: Array.isArray(d.keyPoints) ? (d.keyPoints as string[]).join('\n') : '',
    outline: Array.isArray(d.outline)
      ? (d.outline as Array<Record<string, unknown>>).map((s) => ({
          heading: String(s.heading ?? ''),
          type: String(s.type ?? 'h2'),
          notes: String(s.notes ?? ''),
          wordCount: String(s.wordCount ?? ''),
        }))
      : [],
  };
}

function editStateToBriefData(e: BriefEditState): Record<string, unknown> {
  return {
    title: e.title,
    metaDescription: e.metaDescription,
    targetKeyword: e.targetKeyword,
    secondaryKeywords: e.secondaryKeywords.split('\n').map((s) => s.trim()).filter(Boolean),
    targetWordCount: e.targetWordCount ? Number(e.targetWordCount) : undefined,
    contentType: e.contentType,
    tone: e.tone,
    funnelStage: e.funnelStage,
    intent: e.intent,
    callToAction: e.callToAction,
    keyPoints: e.keyPoints.split('\n').map((s) => s.trim()).filter(Boolean),
    outline: e.outline.map((s) => ({
      heading: s.heading,
      type: s.type,
      notes: s.notes,
      wordCount: s.wordCount ? Number(s.wordCount) : undefined,
    })),
  };
}

// ─── Main component ───────────────────────────────────────────────────────

export function PageDetailPanel({ projectId, mapId, pageId, onClose, onContentGenerated }: PageDetailPanelProps) {
  const [page, setPage] = useState<TopicalMapPageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [briefEditing, setBriefEditing] = useState(false);
  const [briefEditData, setBriefEditData] = useState<BriefEditState | null>(null);
  const [viewingContent, setViewingContent] = useState<'brief' | 'article'>('brief');
  const [articleEditing, setArticleEditing] = useState(false);
  const [imageShowPlaceholders, setImageShowPlaceholders] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTopicalMapPage(projectId, mapId, pageId);
      setPage(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  }, [projectId, mapId, pageId]);

  useEffect(() => { load(); }, [load]);

  const brief = page?.contentPieces.find((p) => p.type === 'brief') as ContentPieceWithImages | undefined;
  const article = page?.contentPieces.find((p) => p.type === 'article') as ContentPieceWithImages | undefined;
  const images = page?.contentPieces.flatMap((p) => p.images ?? []) ?? [];
  const isPublished = article?.status === 'published' || brief?.status === 'published';

  // Auto-expand the brief section as soon as it's available
  useEffect(() => {
    if (brief?.briefData != null) {
      setBriefExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief?.id]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  async function handleGenerateBrief() {
    setBusy('generating-brief');
    setError(null);
    try {
      if (!page?.id) await syncTopicalMapPages(projectId, mapId);
      await generateBriefForPage(projectId, pageId);
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief generation failed');
    } finally {
      setBusy('idle');
    }
  }

  async function handleRegenerateBrief() {
    if (!brief) return;
    setBusy('regenerating');
    setError(null);
    setBriefEditing(false);
    try {
      await deleteContentPiece(projectId, brief.id);
      // Also delete the article since it's now based on a stale brief
      if (article) await deleteContentPiece(projectId, article.id).catch(() => null);
      await generateBriefForPage(projectId, pageId);
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed');
    } finally {
      setBusy('idle');
    }
  }

  async function handleApproveBrief() {
    if (!brief) return;
    setBusy('approving');
    setError(null);
    try {
      await updateContentStatus(projectId, brief.id, 'approved');
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setBusy('idle');
    }
  }

  function handleStartEdit() {
    if (!brief) return;
    setBriefEditData(briefToEditState(brief.briefData));
    setBriefEditing(true);
    setBriefExpanded(true);
  }

  async function handleSaveBrief(editState: BriefEditState) {
    if (!brief) return;
    setBusy('saving');
    setError(null);
    try {
      await updateContentPiece(projectId, brief.id, { briefData: editStateToBriefData(editState) });
      setBriefEditing(false);
      setBriefEditData(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy('idle');
    }
  }

  async function handleGenerateArticle() {
    setBusy('generating-article');
    setError(null);
    try {
      await generateArticleForPage(projectId, pageId);
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Article generation failed');
    } finally {
      setBusy('idle');
    }
  }

  async function handleApproveArticle() {
    if (!article) return;
    setBusy('approving');
    setError(null);
    try {
      await updateContentStatus(projectId, article.id, 'approved');
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setBusy('idle');
    }
  }

  function handleStartEditArticle() {
    if (!article) return;
    setArticleEditing(true);
  }

  async function handleSaveArticle(articleData: Record<string, unknown>) {
    if (!article) return;
    setBusy('saving');
    setError(null);
    try {
      await updateContentPiece(projectId, article.id, { articleData });
      setArticleEditing(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy('idle');
    }
  }

  async function handleRegenerateArticle() {
    if (!article) return;
    setBusy('regenerating');
    setError(null);
    setArticleEditing(false);
    try {
      await deleteContentPiece(projectId, article.id);
      await generateArticleForPage(projectId, pageId);
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed');
    } finally {
      setBusy('idle');
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────

  function renderBody(): React.JSX.Element {
    if (loading) {
      return (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      );
    }
    if (error && !page) {
      return (
        <div className="p-5">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={load} className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300">Retry</button>
        </div>
      );
    }
    if (!page) return <div />;

    return (
      <div className="space-y-0">
        <PageMetadataStrip page={page} />

        <div className="border-b border-zinc-800/60 px-5 py-3">
          <p className="text-[10px] text-zinc-600">{page.pillarTitle} › {page.clusterTitle}</p>
        </div>

        {/* Pipeline stages */}
        <div className="px-5 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Content Pipeline</p>
          {error && (
            <p className="mb-3 rounded bg-red-900/20 px-2 py-1.5 text-xs text-red-400">{error}</p>
          )}
          <div className="space-y-2">
            <PipelineStage
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Brief"
              done={!!brief}
              status={brief?.status}
              action={!brief ? (
                <button
                  onClick={handleGenerateBrief}
                  disabled={busy !== 'idle'}
                  className="flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {busy === 'generating-brief' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {busy === 'generating-brief' ? 'Generating…' : 'Generate Brief'}
                </button>
              ) : null}
            />
            <PipelineStage
              icon={<BookOpen className="h-3.5 w-3.5" />}
              label="Article"
              done={!!article}
              status={article?.status}
              locked={!brief}
              onClick={article ? () => { setViewingContent('article'); setArticleEditing(false); } : undefined}
              action={brief && !article ? (
                <button
                  onClick={handleGenerateArticle}
                  disabled={busy !== 'idle'}
                  className="flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {busy === 'generating-article' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {busy === 'generating-article' ? 'Generating…' : 'Generate Article'}
                </button>
              ) : null}
            />
            <PipelineStage
              icon={<Image className="h-3.5 w-3.5" />}
              label="Images"
              done={images.length > 0}
              locked={!article}
              meta={images.length > 0 ? `${images.length} images` : undefined}
            />
            <PipelineStage icon={<Globe className="h-3.5 w-3.5" />} label="Published" done={isPublished} locked={!article} />
          </div>
        </div>

        {/* ── Brief section ─────────────────────────────────────────── */}
        {brief?.briefData != null && (
          <div className="border-t border-zinc-800/60">
            {/* Header with inline actions */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">Brief</span>
                {brief.status && (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium capitalize ${
                    brief.status === 'approved' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {brief.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {brief.status !== 'approved' && !briefEditing && (
                  <button
                    onClick={handleApproveBrief}
                    disabled={busy !== 'idle'}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-emerald-500 hover:bg-emerald-900/20 disabled:opacity-40"
                  >
                    {busy === 'approving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve
                  </button>
                )}
                {!briefEditing ? (
                  <button
                    onClick={handleStartEdit}
                    disabled={busy !== 'idle'}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : (
                  <button
                    onClick={() => { setBriefEditing(false); setBriefEditData(null); }}
                    className="rounded px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                )}
                {!briefEditing && (
                  <button
                    onClick={handleRegenerateBrief}
                    disabled={busy !== 'idle'}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {busy === 'regenerating' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Regenerate
                  </button>
                )}
                <button
                  onClick={() => setBriefExpanded((v) => !v)}
                  className="rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${briefExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {briefExpanded && (
              <div className="border-t border-zinc-800/60 px-5 pb-6 pt-4">
                {briefEditing && briefEditData ? (
                  <BriefEditForm
                    data={briefEditData}
                    saving={busy === 'saving'}
                    onChange={setBriefEditData}
                    onSave={handleSaveBrief}
                    onCancel={() => { setBriefEditing(false); setBriefEditData(null); }}
                  />
                ) : (
                  <BriefPreview data={brief.briefData} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Article section ───────────────────────────────────────── */}
        {article?.articleData != null && viewingContent === 'article' && (
          <div className="border-t border-zinc-800/60">
            {/* Header with inline actions */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">Article</span>
                {article.wordCount != null && <span className="text-[10px] text-zinc-600">· {article.wordCount} words</span>}
                {article.status && (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium capitalize ${
                    article.status === 'approved' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {article.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {article.status !== 'approved' && !articleEditing && (
                  <button
                    onClick={handleApproveArticle}
                    disabled={busy !== 'idle'}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-emerald-500 hover:bg-emerald-900/20 disabled:opacity-40"
                  >
                    {busy === 'approving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve
                  </button>
                )}
                {!articleEditing ? (
                  <button
                    onClick={handleStartEditArticle}
                    disabled={busy !== 'idle'}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : (
                  <button
                    onClick={() => setArticleEditing(false)}
                    className="rounded px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                )}
                {!articleEditing && (
                  <button
                    onClick={handleRegenerateArticle}
                    disabled={busy !== 'idle'}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {busy === 'regenerating' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Regenerate
                  </button>
                )}
                <button
                  onClick={() => setViewingContent('brief')}
                  className="rounded px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800"
                >
                  ← Brief
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-800/60 px-5 pb-6 pt-4">
              {articleEditing ? (
                <ArticleEditForm
                  data={article.articleData as Record<string, unknown>}
                  saving={busy === 'saving'}
                  onSave={handleSaveArticle}
                  onCancel={() => setArticleEditing(false)}
                  imageShowPlaceholders={imageShowPlaceholders}
                  onImagePlaceholdersChange={setImageShowPlaceholders}
                />
              ) : (
                <ArticleFormatter data={article.articleData as Record<string, unknown>} images={images} showImagePlaceholders={imageShowPlaceholders} />
              )}
            </div>
          </div>
        )}

        {/* Keyword & internal links */}
        {page.keyword != null && (
          <div className="border-t border-zinc-800/60 px-5 py-3">
            <p className="text-[10px] text-zinc-600">Primary keyword</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">{page.keyword}</p>
          </div>
        )}
        {((page.linksTo?.length ?? 0) > 0 || (page.linksFrom?.length ?? 0) > 0) && (
          <div className="border-t border-zinc-800/60 px-5 py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Internal Linking</p>
            {(page.linksTo?.length ?? 0) > 0 && (
              <div className="mb-1.5">
                <p className="text-[10px] text-zinc-600">Links to:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {page.linksTo!.map((url) => <span key={url} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{url}</span>)}
                </div>
              </div>
            )}
            {(page.linksFrom?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-zinc-600">Links from:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {page.linksFrom!.map((url) => <span key={url} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{url}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="fixed inset-y-0 right-0 z-50 flex w-[1040px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-800" />
          ) : (
            <>
              <p className="text-sm font-semibold leading-snug text-zinc-100">{page?.title ?? 'Page Details'}</p>
              {page?.suggestedUrl && <p className="mt-0.5 truncate text-[11px] text-zinc-600">{page.suggestedUrl}</p>}
            </>
          )}
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{renderBody()}</div>
    </div>
    </>
  );
}

// ─── Article Formatter (HTML rendering with image placeholders) ────────────

interface ArticleFormatterProps {
  data: Record<string, unknown>;
  images: ContentImage[];
  showImagePlaceholders: boolean;
}

function ArticleFormatter({ data, images, showImagePlaceholders }: ArticleFormatterProps) {
  const markdown = String(data.markdown ?? '');
  if (!markdown) return <p className="text-xs text-zinc-600">No content available.</p>;

  const lines = markdown.split('\n');
  const imageCount = showImagePlaceholders ? Math.ceil(lines.length / 300) : 0;

  return (
    <div className="prose prose-invert max-w-none space-y-4">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="text-3xl font-bold text-zinc-100">
              {line.replace(/^# /, '')}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="mt-6 text-2xl font-bold text-zinc-100">
              {line.replace(/^## /, '')}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="mt-4 text-xl font-semibold text-zinc-200">
              {line.replace(/^### /, '')}
            </h3>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 text-sm text-zinc-300">
              <span>•</span>
              <span>{line.replace(/^[-*] /, '')}</span>
            </div>
          );
        }
        if (line.match(/^\d+\. /)) {
          return (
            <div key={i} className="flex gap-2 text-sm text-zinc-300">
              <span>{line.match(/^\d+/)?.[0]}.</span>
              <span>{line.replace(/^\d+\. /, '')}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-zinc-400">
            {line}
          </p>
        );
      })}

      {/* Image placeholders */}
      {showImagePlaceholders && imageCount > 0 && (
        <div className="mt-8 space-y-4 border-t border-zinc-800 pt-6">
          <p className="text-xs font-semibold uppercase text-zinc-600">Images</p>
          <div className="grid gap-4">
            {Array.from({ length: imageCount }).map((_, i) => (
              <div key={i} className="flex min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/30">
                <div className="text-center">
                  <Image className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-2 text-xs text-zinc-500">Image placeholder {i + 1}</p>
                  <p className="text-[10px] text-zinc-600">Click to generate or remove</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Article Edit Form ────────────────────────────────────────────────────

function ArticleEditForm({
  data,
  saving,
  onSave,
  onCancel,
  imageShowPlaceholders,
  onImagePlaceholdersChange,
}: {
  data: Record<string, unknown>;
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  imageShowPlaceholders: boolean;
  onImagePlaceholdersChange: (show: boolean) => void;
}) {
  const [editedContent, setEditedContent] = useState(String(data.markdown ?? ''));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-medium text-zinc-600">Article Content</p>
          <label className="flex items-center gap-1 text-[10px] text-zinc-500">
            <input
              type="checkbox"
              checked={imageShowPlaceholders}
              onChange={(e) => onImagePlaceholdersChange(e.target.checked)}
              className="h-3 w-3"
            />
            Show image placeholders
          </label>
        </div>
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={10}
          className="w-full resize-none rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="Markdown content..."
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ markdown: editedContent })}
          disabled={saving}
          className="flex items-center gap-1.5 rounded bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {saving ? 'Saving…' : 'Save Article'}
        </button>
      </div>
    </div>
  );
}

// ─── Brief Edit Form ──────────────────────────────────────────────────────

function BriefEditForm({
  data, saving, onChange, onSave, onCancel,
}: {
  data: BriefEditState;
  saving: boolean;
  onChange: (d: BriefEditState) => void;
  onSave: (d: BriefEditState) => void;
  onCancel: () => void;
}) {
  const set = (key: keyof BriefEditState, value: string) => onChange({ ...data, [key]: value });

  const updateOutline = (i: number, key: keyof OutlineSection, value: string) => {
    const outline = data.outline.map((s, idx) => idx === i ? { ...s, [key]: value } : s);
    onChange({ ...data, outline });
  };

  return (
    <div className="space-y-4">
      <Field label="SEO Title">
        <input value={data.title} onChange={(e) => set('title', e.target.value)}
          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="Title tag (50–60 chars)" />
      </Field>

      <Field label="Meta Description">
        <textarea value={data.metaDescription} onChange={(e) => set('metaDescription', e.target.value)}
          rows={2} className="w-full resize-none rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="150–160 chars" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Target Keyword">
          <input value={data.targetKeyword} onChange={(e) => set('targetKeyword', e.target.value)}
            className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
        </Field>
        <Field label="Word Count">
          <input type="number" value={data.targetWordCount} onChange={(e) => set('targetWordCount', e.target.value)}
            className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Tone">
          <input value={data.tone} onChange={(e) => set('tone', e.target.value)}
            className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
            placeholder="professional" />
        </Field>
        <Field label="Intent">
          <input value={data.intent} onChange={(e) => set('intent', e.target.value)}
            className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
            placeholder="informational" />
        </Field>
        <Field label="Funnel">
          <input value={data.funnelStage} onChange={(e) => set('funnelStage', e.target.value)}
            className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
            placeholder="TOFU" />
        </Field>
      </div>

      <Field label="Call to Action">
        <input value={data.callToAction} onChange={(e) => set('callToAction', e.target.value)}
          className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
      </Field>

      <Field label="Key Points (one per line)">
        <textarea value={data.keyPoints} onChange={(e) => set('keyPoints', e.target.value)}
          rows={3} className="w-full resize-none rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
      </Field>

      <Field label="Secondary Keywords (one per line)">
        <textarea value={data.secondaryKeywords} onChange={(e) => set('secondaryKeywords', e.target.value)}
          rows={2} className="w-full resize-none rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
      </Field>

      {/* Outline editor */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Outline</p>
          <button
            onClick={() => onChange({ ...data, outline: [...data.outline, { heading: '', type: 'h2', notes: '', wordCount: '' }] })}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            <Plus className="h-3 w-3" /> Add section
          </button>
        </div>
        <div className="space-y-2">
          {data.outline.map((section, i) => (
            <div key={i} className="rounded border border-zinc-800 bg-zinc-900/60 p-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <input value={section.type} onChange={(e) => updateOutline(i, 'type', e.target.value)}
                  className="w-12 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-center text-[10px] text-zinc-400 focus:border-zinc-600 focus:outline-none"
                  placeholder="h2" />
                <input value={section.heading} onChange={(e) => updateOutline(i, 'heading', e.target.value)}
                  className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                  placeholder="Section heading" />
                <input type="number" value={section.wordCount} onChange={(e) => updateOutline(i, 'wordCount', e.target.value)}
                  className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 focus:border-zinc-600 focus:outline-none"
                  placeholder="words" />
                <button onClick={() => onChange({ ...data, outline: data.outline.filter((_, idx) => idx !== i) })}
                  className="rounded p-0.5 text-zinc-700 hover:text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <textarea value={section.notes} onChange={(e) => updateOutline(i, 'notes', e.target.value)}
                rows={1} className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 placeholder-zinc-700 focus:border-zinc-600 focus:outline-none"
                placeholder="Notes for this section (optional)" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="rounded px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
          Cancel
        </button>
        <button
          onClick={() => onSave(data)}
          disabled={saving}
          className="flex items-center gap-1.5 rounded bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {saving ? 'Saving…' : 'Save Brief'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium text-zinc-600">{label}</p>
      {children}
    </div>
  );
}

function PageMetadataStrip({ page }: { page: TopicalMapPageDetail }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-800/60 px-5 py-3">
      {page.intent != null && <MetaBadge label={page.intent} color="blue" />}
      {page.funnelStage != null && <MetaBadge label={page.funnelStage} color="violet" />}
      {page.volume != null && <MetaBadge label={`${formatNum(page.volume)} vol`} color="zinc" />}
      {page.difficulty != null && <MetaBadge label={`KD ${page.difficulty}`} color="zinc" />}
      {page.contentType != null && <MetaBadge label={page.contentType} color="zinc" />}
      {(page.estimatedWordCount ?? 0) > 0 && <MetaBadge label={`~${page.estimatedWordCount} words`} color="zinc" />}
    </div>
  );
}

function PipelineStage({ icon, label, done, locked, status, meta, action, onClick }: {
  icon: React.ReactNode; label: string; done?: boolean; locked?: boolean;
  status?: string; meta?: string; action?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 transition-all ${
      done ? 'border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-950/40' : locked ? 'border-zinc-800/40 bg-zinc-900/20 opacity-40 cursor-default' : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60'
    }`}>
      <div className={`flex items-center gap-2 ${done ? 'text-emerald-400' : locked ? 'text-zinc-700' : 'text-zinc-500'}`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : locked ? <Clock className="h-3.5 w-3.5" /> : icon}
        <span className="text-xs font-medium">{label}</span>
        {done && status === 'approved' && <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[9px] text-emerald-500">approved</span>}
        {meta && <span className="text-[10px] text-zinc-600">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

function MetaBadge({ label, color }: { label: string; color: 'blue' | 'violet' | 'zinc' }) {
  const s = { blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20', violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20', zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${s[color]}`}>{label}</span>;
}

function BriefPreview({ data }: { data: unknown }) {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d !== 'object') return null;
  return (
    <div className="space-y-4">
      {!!d.title && <PreviewSection label="SEO Title"><p className="text-xs text-zinc-200">{String(d.title)}</p></PreviewSection>}
      {!!d.metaDescription && <PreviewSection label="Meta Description"><p className="text-xs leading-relaxed text-zinc-400">{String(d.metaDescription)}</p></PreviewSection>}
      <div className="flex flex-wrap gap-3">
        {!!d.targetKeyword && <KV label="Keyword" value={String(d.targetKeyword)} />}
        {!!d.targetWordCount && <KV label="Word Count" value={String(d.targetWordCount)} />}
        {!!d.tone && <KV label="Tone" value={String(d.tone)} />}
        {!!d.intent && <KV label="Intent" value={String(d.intent)} />}
        {!!d.funnelStage && <KV label="Funnel" value={String(d.funnelStage)} />}
        {!!d.contentType && <KV label="Type" value={String(d.contentType)} />}
      </div>
      {Array.isArray(d.keyPoints) && d.keyPoints.length > 0 && (
        <PreviewSection label="Key Points">
          <ul className="space-y-0.5">
            {(d.keyPoints as string[]).map((kp, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />{kp}
              </li>
            ))}
          </ul>
        </PreviewSection>
      )}
      {Array.isArray(d.outline) && d.outline.length > 0 && (
        <PreviewSection label="Outline">
          <div className="space-y-1.5">
            {(d.outline as Array<{ heading: string; type?: string; notes?: string; wordCount?: number }>).map((s, i) => (
              <div key={i} className="rounded border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[9px] font-mono text-zinc-500">{s.type ?? 'h2'}</span>
                  <p className="text-[11px] font-medium text-zinc-300">{s.heading}</p>
                  {s.wordCount && <span className="ml-auto shrink-0 text-[9px] text-zinc-600">{s.wordCount}w</span>}
                </div>
                {s.notes && <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">{s.notes}</p>}
              </div>
            ))}
          </div>
        </PreviewSection>
      )}
      {!!d.callToAction && <PreviewSection label="Call to Action"><p className="text-xs text-zinc-400">{String(d.callToAction)}</p></PreviewSection>}
    </div>
  );
}

function PreviewSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{label}</p>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="text-[11px] font-medium capitalize text-zinc-300">{value}</p>
    </div>
  );
}

function ArticlePreview({ data, isFullView }: { data: unknown; isFullView?: boolean }) {
  const markdown = ((data ?? {}) as Record<string, unknown>).markdown as string | undefined;
  if (!markdown) return <p className="text-xs text-zinc-600">No content available.</p>;
  const preview = isFullView ? markdown : markdown.slice(0, 800);
  return <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-400">{preview}{!isFullView && markdown.length > 800 ? '…' : ''}</pre>;
}

function formatNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
