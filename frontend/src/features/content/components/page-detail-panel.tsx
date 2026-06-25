'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, FileText, BookOpen, Image, Globe, Loader2, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import {
  fetchTopicalMapPage,
  generateBriefForPage,
  generateArticleForPage,
  syncTopicalMapPages,
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

type GeneratingState = 'idle' | 'generating-brief' | 'generating-article';

export function PageDetailPanel({ projectId, mapId, pageId, onClose, onContentGenerated }: PageDetailPanelProps) {
  const [page, setPage] = useState<TopicalMapPageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<GeneratingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [articleExpanded, setArticleExpanded] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  const brief = page?.contentPieces.find((p) => p.type === 'brief');
  const article = page?.contentPieces.find((p) => p.type === 'article');
  // Images can be attached to any content piece for this page
  const images = page?.contentPieces.flatMap((p) => p.images ?? []) ?? [];
  const isPublished =
    article?.status === 'published' || brief?.status === 'published';

  async function handleGenerateBrief() {
    setGenerating('generating-brief');
    setError(null);
    try {
      // If page isn't yet in the pages table, sync first
      if (!page?.id) {
        await syncTopicalMapPages(projectId, mapId);
      }
      await generateBriefForPage(projectId, pageId);
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief generation failed');
    } finally {
      setGenerating('idle');
    }
  }

  async function handleGenerateArticle() {
    setGenerating('generating-article');
    setError(null);
    try {
      await generateArticleForPage(projectId, pageId);
      await load();
      onContentGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Article generation failed');
    } finally {
      setGenerating('idle');
    }
  }

  const busyBrief = generating === 'generating-brief';
  const busyArticle = generating === 'generating-article';

  function renderBody(): React.JSX.Element {
    if (loading) {
      return (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-5">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={load} className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300">
            Retry
          </button>
        </div>
      );
    }
    if (!page) {
      return <div />;
    }
    return (
      <PageContent
        page={page}
        brief={brief}
        article={article}
        images={images}
        isPublished={isPublished}
        busyBrief={busyBrief}
        busyArticle={busyArticle}
        briefExpanded={briefExpanded}
        articleExpanded={articleExpanded}
        onToggleBrief={() => setBriefExpanded((v) => !v)}
        onToggleArticle={() => setArticleExpanded((v) => !v)}
        onGenerateBrief={handleGenerateBrief}
        onGenerateArticle={handleGenerateArticle}
      />
    );
  }


  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[520px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-800" />
          ) : (
            <>
              <p className="text-sm font-semibold leading-snug text-zinc-100">
                {page?.title ?? 'Page Details'}
              </p>
              {page?.suggestedUrl && (
                <p className="mt-0.5 truncate text-[11px] text-zinc-600">{page.suggestedUrl}</p>
              )}
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">{renderBody()}</div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

type ContentPieceWithImages = ContentPiece & { images?: ContentImage[] };

interface PageContentProps {
  page: TopicalMapPageDetail;
  brief: ContentPieceWithImages | undefined;
  article: ContentPieceWithImages | undefined;
  images: ContentImage[];
  isPublished: boolean;
  busyBrief: boolean;
  busyArticle: boolean;
  briefExpanded: boolean;
  articleExpanded: boolean;
  onToggleBrief: () => void;
  onToggleArticle: () => void;
  onGenerateBrief: () => void;
  onGenerateArticle: () => void;
}

function PageContent({
  page,
  brief,
  article,
  images,
  isPublished,
  busyBrief,
  busyArticle,
  briefExpanded,
  articleExpanded,
  onToggleBrief,
  onToggleArticle,
  onGenerateBrief,
  onGenerateArticle,
}: PageContentProps): React.JSX.Element {
  return (
    <div className="space-y-0">
      <PageMetadataStrip page={page} />

      {/* Cluster context */}
      <div className="border-b border-zinc-800/60 px-5 py-3">
        <p className="text-[10px] text-zinc-600">
          {page.pillarTitle} &rsaquo; {page.clusterTitle}
        </p>
      </div>

      {/* Pipeline */}
      <div className="px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Content Pipeline
        </p>
        <div className="space-y-2">
          <PipelineStage
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Brief"
            done={!!brief}
            status={brief?.status}
            action={
              !brief ? (
                <button
                  onClick={onGenerateBrief}
                  disabled={busyBrief}
                  className="flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {busyBrief && <Loader2 className="h-3 w-3 animate-spin" />}
                  {busyBrief ? 'Generating\u2026' : 'Generate Brief'}
                </button>
              ) : null
            }
          />
          <PipelineStage
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Article"
            done={!!article}
            status={article?.status}
            locked={!brief}
            action={
              brief && !article ? (
                <button
                  onClick={onGenerateArticle}
                  disabled={busyArticle}
                  className="flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {busyArticle && <Loader2 className="h-3 w-3 animate-spin" />}
                  {busyArticle ? 'Generating\u2026' : 'Generate Article'}
                </button>
              ) : null
            }
          />
          <PipelineStage
            icon={<Image className="h-3.5 w-3.5" />}
            label="Images"
            done={images.length > 0}
            locked={!article}
            meta={images.length > 0 ? `${images.length} images` : undefined}
          />
          <PipelineStage
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Published"
            done={isPublished}
            locked={!article}
          />
        </div>
      </div>

      {/* Brief preview */}
      {brief?.briefData != null ? (
        <div className="border-t border-zinc-800/60">
          <button
            onClick={onToggleBrief}
            className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-zinc-900/40"
          >
            <span className="text-xs font-medium text-zinc-400">Brief</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-zinc-600 transition-transform ${briefExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {briefExpanded && (
            <div className="border-t border-zinc-800/60 px-5 pb-5 pt-3">
              <BriefPreview data={brief.briefData} />
            </div>
          )}
        </div>
      ) : null}

      {/* Article preview */}
      {article?.articleData != null ? (
        <div className="border-t border-zinc-800/60">
          <button
            onClick={onToggleArticle}
            className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-zinc-900/40"
          >
            <span className="text-xs font-medium text-zinc-400">
              Article
              {article.wordCount != null ? (
                <span className="ml-2 text-zinc-600">&middot; {article.wordCount} words</span>
              ) : null}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-zinc-600 transition-transform ${articleExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {articleExpanded && (
            <div className="border-t border-zinc-800/60 px-5 pb-5 pt-3">
              <ArticlePreview data={article.articleData} />
            </div>
          )}
        </div>
      ) : null}

      {/* Keyword info */}
      {page.keyword != null ? (
        <div className="border-t border-zinc-800/60 px-5 py-3">
          <p className="text-[10px] text-zinc-600">Primary keyword</p>
          <p className="mt-0.5 text-xs font-medium text-zinc-400">{page.keyword}</p>
        </div>
      ) : null}

      {/* Internal links */}
      {(page.linksTo != null && page.linksTo.length > 0) ||
      (page.linksFrom != null && page.linksFrom.length > 0) ? (
        <div className="border-t border-zinc-800/60 px-5 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Internal Linking
          </p>
          {page.linksTo != null && page.linksTo.length > 0 ? (
            <div className="mb-1.5">
              <p className="text-[10px] text-zinc-600">Links to:</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {page.linksTo.map((url) => (
                  <span key={url} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {url}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {page.linksFrom != null && page.linksFrom.length > 0 ? (
            <div>
              <p className="text-[10px] text-zinc-600">Links from:</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {page.linksFrom.map((url) => (
                  <span key={url} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {url}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PageMetadataStrip({ page }: { page: TopicalMapPageDetail }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-800/60 px-5 py-3">
      {page.intent != null ? <MetaBadge label={page.intent} color="blue" /> : null}
      {page.funnelStage != null ? <MetaBadge label={page.funnelStage} color="violet" /> : null}
      {page.volume != null ? (
        <MetaBadge label={`${formatNum(page.volume)} vol`} color="zinc" />
      ) : null}
      {page.difficulty != null ? (
        <MetaBadge label={`KD ${page.difficulty}`} color="zinc" />
      ) : null}
      {page.contentType != null ? <MetaBadge label={page.contentType} color="zinc" /> : null}
      {page.estimatedWordCount != null && page.estimatedWordCount > 0 ? (
        <MetaBadge label={`~${page.estimatedWordCount} words`} color="zinc" />
      ) : null}
    </div>
  );
}

function PipelineStage({
  icon,
  label,
  done,
  locked,
  status,
  meta,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  done?: boolean;
  locked?: boolean;
  status?: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  const textColor = done
    ? 'text-emerald-400'
    : locked
    ? 'text-zinc-700'
    : 'text-zinc-500';

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2 ${
        done
          ? 'border-emerald-800/40 bg-emerald-950/20'
          : locked
          ? 'border-zinc-800/40 bg-zinc-900/20 opacity-40'
          : 'border-zinc-800 bg-zinc-900/40'
      }`}
    >
      <div className={`flex items-center gap-2 ${textColor}`}>
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : locked ? (
          <Clock className="h-3.5 w-3.5" />
        ) : (
          icon
        )}
        <span className="text-xs font-medium">{label}</span>
        {status && !done && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
            {status}
          </span>
        )}
        {meta && <span className="text-[10px] text-zinc-600">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

function MetaBadge({ label, color }: { label: string; color: 'blue' | 'violet' | 'zinc' }) {
  const styles = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${styles[color]}`}>
      {label}
    </span>
  );
}

function BriefPreview({ data }: { data: unknown }) {
  const d = data as Record<string, unknown>;
  if (!d || typeof d !== 'object') return null;

  return (
    <div className="space-y-3">
      {!!d.title && (
        <div>
          <p className="text-[10px] text-zinc-600">Title</p>
          <p className="text-xs text-zinc-300">{String(d.title)}</p>
        </div>
      )}
      {!!d.metaDescription && (
        <div>
          <p className="text-[10px] text-zinc-600">Meta Description</p>
          <p className="text-xs text-zinc-400">{String(d.metaDescription)}</p>
        </div>
      )}
      {Array.isArray(d.outline) && d.outline.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] text-zinc-600">Outline</p>
          <div className="space-y-1">
            {(d.outline as Array<{ heading: string; notes?: string }>).map((section, i) => (
              <div key={i} className="rounded bg-zinc-900 px-2.5 py-1.5">
                <p className="text-[11px] font-medium text-zinc-300">{section.heading}</p>
                {section.notes && (
                  <p className="mt-0.5 text-[10px] text-zinc-600">{section.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!!d.callToAction && (
        <div>
          <p className="text-[10px] text-zinc-600">CTA</p>
          <p className="text-xs text-zinc-400">{String(d.callToAction)}</p>
        </div>
      )}
    </div>
  );
}

function ArticlePreview({ data }: { data: unknown }) {
  const d = data as Record<string, unknown>;
  const markdown = d?.markdown as string | undefined;
  if (!markdown) return <p className="text-xs text-zinc-600">No content available.</p>;

  // Show first 800 chars with a fade
  const preview = markdown.slice(0, 800);
  return (
    <div className="relative">
      <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-400">
        {preview}
        {markdown.length > 800 ? '…' : ''}
      </pre>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
