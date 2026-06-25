'use client';

import { useState } from 'react';
import type { TopicalMapPage } from '@/features/content/services/content.service';

/** Indexed by page title for O(1) lookup in the renderer. */
export type PageStatusMap = Record<string, TopicalMapPage>;

interface PageItem {
  title: string;
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  funnelStage?: string;
  contentType?: string;
  estimatedWordCount?: number;
  effort?: string;
  suggestedUrl?: string;
  linksTo?: string[];
  linksFrom?: string[];
}

interface Cluster {
  id: string;
  name: string;
  hubKeyword?: string;
  hubUrl?: string;
  intent?: string;
  priority?: string;
  pages?: PageItem[];
}

interface Pillar {
  id: string;
  name: string;
  description?: string;
  pillarPageKeyword?: string;
  pillarPageUrl?: string;
  estimatedTotalVolume?: number;
  clusters?: Cluster[];
}

interface CalendarMonth {
  month: string;
  pieces?: Array<{ title: string; keyword?: string; pillar?: string; cluster?: string; contentType?: string; priority?: string; week?: number }>;
}

interface TopicalMapData {
  pillars?: Pillar[];
  calendar?: CalendarMonth[];
  linkingArchitecture?: { strategy?: string; rules?: string[] };
  contentPillars?: Array<{
    pillar: string;
    clusters?: Array<{
      cluster: string;
      contentPieces?: Array<{
        targetKeyword: string;
        contentType?: string;
        searchIntent?: string;
        priorityScore?: number;
        internalLinking?: string[];
      }>;
    }>;
  }>;
  contentCalendar?: Array<{ month: string; contentPieces?: string[] }>;
  internalLinkingArchitecture?: Record<string, string[]>;
  stats?: {
    totalPillars?: number;
    totalClusters?: number;
    totalPages?: number;
    totalEstimatedWords?: number;
    byContentType?: Record<string, number>;
    byPriority?: Record<string, number>;
    byFunnel?: Record<string, number>;
  };
  summary?: string;
  [key: string]: unknown;
}

function normalizePillars(d: TopicalMapData): Pillar[] {
  if (d.pillars && d.pillars.length > 0) return d.pillars;
  if (!d.contentPillars) return [];
  return d.contentPillars.map((cp, pi) => ({
    id: `p-${pi}`,
    name: cp.pillar,
    clusters: (cp.clusters ?? []).map((cc, ci) => ({
      id: `p-${pi}-c-${ci}`,
      name: cc.cluster,
      pages: (cc.contentPieces ?? []).map((piece) => ({
        title: piece.targetKeyword,
        keyword: piece.targetKeyword,
        contentType: piece.contentType,
        intent: piece.searchIntent,
        linksTo: piece.internalLinking,
      })),
    })),
  }));
}

function normalizeCalendar(d: TopicalMapData): CalendarMonth[] {
  if (d.calendar && d.calendar.length > 0) return d.calendar;
  if (!d.contentCalendar) return [];
  return d.contentCalendar.map((cm) => ({
    month: cm.month,
    pieces: (cm.contentPieces ?? []).map((kw) => ({ title: kw, keyword: kw })),
  }));
}

function normalizeLinking(d: TopicalMapData): { strategy?: string; rules?: string[] } | null {
  if (d.linkingArchitecture) return d.linkingArchitecture;
  if (!d.internalLinkingArchitecture) return null;
  const rules = Object.entries(d.internalLinkingArchitecture).map(
    ([from, tos]) => `${from} â†’ ${tos.join(', ')}`,
  );
  return { strategy: 'Internal linking map between content pieces', rules };
}

function computeStats(pillars: Pillar[], d: TopicalMapData) {
  if (d.stats) return d.stats;
  const totalClusters = pillars.reduce((s, p) => s + (p.clusters?.length ?? 0), 0);
  const totalPages = pillars.reduce(
    (s, p) => s + (p.clusters ?? []).reduce((cs, c) => cs + (c.pages?.length ?? 0), 0),
    0,
  );
  if (pillars.length === 0) return undefined;
  return { totalPillars: pillars.length, totalClusters, totalPages };
}

// Pillar accent colors â€” cycles through a palette
const PILLAR_COLORS = [
  { bar: 'bg-violet-500', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20', ring: 'border-violet-500/30' },
  { bar: 'bg-blue-500',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       ring: 'border-blue-500/30' },
  { bar: 'bg-emerald-500',badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', ring: 'border-emerald-500/30' },
  { bar: 'bg-amber-500',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',    ring: 'border-amber-500/30' },
  { bar: 'bg-rose-500',   badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',       ring: 'border-rose-500/30' },
  { bar: 'bg-cyan-500',   badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',       ring: 'border-cyan-500/30' },
  { bar: 'bg-purple-500', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', ring: 'border-purple-500/30' },
];

export function TopicalMapRenderer({
  data,
  pageStatusMap,
  onPageClick,
}: {
  data: unknown;
  pageStatusMap?: PageStatusMap;
  onPageClick?: (pageId: string, pageTitle: string) => void;
}) {
  const d = data as TopicalMapData;
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'calendar'>('map');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  if (!d || typeof d !== 'object') {
    return <p className="text-sm text-zinc-500">No topical map data available.</p>;
  }

  const pillars = normalizePillars(d);
  const calendar = normalizeCalendar(d);
  const linking = normalizeLinking(d);
  const stats = computeStats(pillars, d);

  // Compute max volume for relative progress bars
  const maxVol = pillars.reduce((m, p) => Math.max(m, p.estimatedTotalVolume ?? 0), 0);

  return (
    <div className="space-y-5">

      {/* â”€â”€ Hero Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Pillars" value={stats.totalPillars} accent="text-violet-400" iconPath="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          <StatCard label="Clusters" value={stats.totalClusters} accent="text-blue-400" iconPath="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          <StatCard label="Pages" value={stats.totalPages} accent="text-emerald-400" iconPath="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </div>
      )}

      {/* â”€â”€ Summary (collapsible) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {d.summary && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            onClick={() => setSummaryExpanded(!summaryExpanded)}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Strategic Overview</span>
            <svg
              className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>
          {summaryExpanded && (
            <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-zinc-400">{d.summary}</p>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ View Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {(pillars.length > 0 || calendar.length > 0) && (
        <div className="flex gap-1 border-b border-zinc-800 pb-0">
          <TabButton active={view === 'map'} onClick={() => setView('map')}>
            <svg className="mr-1.5 inline h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            Topical Map
          </TabButton>
          {calendar.length > 0 && (
            <TabButton active={view === 'calendar'} onClick={() => setView('calendar')}>
              <svg className="mr-1.5 inline h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Content Calendar
            </TabButton>
          )}
        </div>
      )}

      {/* â”€â”€ Topical Map View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {view === 'map' && pillars.length > 0 && (
        <div className="space-y-2">
          {pillars.map((pillar, pi) => {
            const color = PILLAR_COLORS[pi % PILLAR_COLORS.length];
            const isOpen = expandedPillar === pillar.id;
            const volPct = maxVol > 0 && pillar.estimatedTotalVolume
              ? Math.round((pillar.estimatedTotalVolume / maxVol) * 100)
              : 0;
            const clusterCount = pillar.clusters?.length ?? 0;
            const pageCount = (pillar.clusters ?? []).reduce((s, c) => s + (c.pages?.length ?? 0), 0);

            return (
              <div
                key={pillar.id}
                className={`rounded-lg border bg-zinc-900/40 transition-colors ${isOpen ? color.ring : 'border-zinc-800'}`}
              >
                {/* Pillar Header */}
                <button
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-zinc-800/20"
                  onClick={() => setExpandedPillar(isOpen ? null : pillar.id)}
                >
                  {/* Color accent bar */}
                  <div className={`mt-1 h-4 w-1 shrink-0 rounded-full ${color.bar}`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-100">{pillar.name}</p>
                        {pillar.description && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                            {pillar.description}
                          </p>
                        )}
                      </div>
                      {/* Right meta */}
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                          {pillar.estimatedTotalVolume !== undefined && (
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${color.badge}`}>
                              {formatNumber(pillar.estimatedTotalVolume)} vol
                            </span>
                          )}
                          <svg
                            className={`h-3.5 w-3.5 text-zinc-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                          </svg>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                          <span>{clusterCount} clusters</span>
                          {pageCount > 0 && <><span>Â·</span><span>{pageCount} pages</span></>}
                        </div>
                      </div>
                    </div>

                    {/* Volume bar */}
                    {volPct > 0 && (
                      <div className="mt-2 h-1 w-full rounded-full bg-zinc-800">
                        <div
                          className={`h-1 rounded-full ${color.bar} opacity-60`}
                          style={{ width: `${volPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </button>

                {/* Clusters */}
                {isOpen && pillar.clusters && (
                  <div className="border-t border-zinc-800/60 px-4 py-3">
                    <div className="space-y-1.5">
                      {pillar.clusters.map((cluster) => {
                        const clusterOpen = expandedCluster === cluster.id;
                        return (
                          <div key={cluster.id}>
                            <button
                              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${clusterOpen ? 'bg-zinc-800/60' : 'bg-zinc-900/60 hover:bg-zinc-800/40'}`}
                              onClick={() => setExpandedCluster(clusterOpen ? null : cluster.id)}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <svg
                                  className={`h-3 w-3 shrink-0 text-zinc-600 transition-transform ${clusterOpen ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                                </svg>
                                <span className="truncate text-[12px] font-medium text-zinc-300">{cluster.name}</span>
                                {cluster.intent && <IntentBadge intent={cluster.intent} />}
                                {cluster.priority && <PriorityBadge priority={cluster.priority} />}
                              </div>
                              <span className="ml-3 shrink-0 text-[10px] text-zinc-600">
                                {cluster.pages?.length ?? 0} pages
                              </span>
                            </button>

                            {/* Pages table */}
                            {clusterOpen && cluster.pages && cluster.pages.length > 0 && (
                              <div className="ml-5 mt-1 overflow-hidden rounded-md border border-zinc-800/60">
                                {/* Table header */}
                                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 border-b border-zinc-800/60 bg-zinc-900/80 px-3 py-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Page Title</span>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Type</span>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Funnel</span>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Vol</span>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">KD</span>
                                </div>
                                {cluster.pages.map((page, i) => {
                                  const pageStatus = pageStatusMap?.[page.title];
                                  const hasBrief = pageStatus?.contentPieces.some((p) => p.type === 'brief');
                                  const hasArticle = pageStatus?.contentPieces.some((p) => p.type === 'article');
                                  const hasImages = pageStatus?.contentPieces.some(
                                    (p) => (((p as { imageCount?: number }).imageCount) ?? 0) > 0,
                                  );
                                  const isPublished = pageStatus?.contentPieces.some(
                                    (p) => p.status === 'published',
                                  );
                                  return (
                                  <div
                                    key={i}
                                    role={onPageClick ? 'button' : undefined}
                                    tabIndex={onPageClick ? 0 : undefined}
                                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 px-3 py-2 ${i % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-900/20'} ${onPageClick ? 'cursor-pointer hover:bg-zinc-800/40' : ''}`}
                                    onClick={() => {
                                      if (!onPageClick || !pageStatus?.id) return;
                                      onPageClick(pageStatus.id, page.title);
                                    }}
                                    onKeyDown={(e) => {
                                      if ((e.key === 'Enter' || e.key === ' ') && onPageClick && pageStatus?.id) {
                                        onPageClick(pageStatus.id, page.title);
                                      }
                                    }}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="truncate text-[11px] text-zinc-300">{page.title}</p>
                                        {pageStatus && (
                                          <div className="flex shrink-0 items-center gap-0.5">
                                            <StatusDot done={!!hasBrief} title="Brief" />
                                            <StatusDot done={!!hasArticle} title="Article" />
                                            <StatusDot done={!!hasImages} title="Images" />
                                            <StatusDot done={!!isPublished} title="Published" />
                                          </div>
                                        )}
                                        {!pageStatus && onPageClick && (
                                          <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-600">
                                            start
                                          </span>
                                        )}
                                      </div>
                                      {page.suggestedUrl && (
                                        <p className="truncate text-[10px] text-zinc-600">{page.suggestedUrl}</p>
                                      )}
                                    </div>
                                    <div>{page.contentType ? <ContentTypeBadge type={page.contentType} /> : <span className="text-[10px] text-zinc-700">–</span>}</div>
                                    <div>
                                      {page.funnelStage
                                        ? <FunnelBadge stage={page.funnelStage} />
                                        : <span className="text-[10px] text-zinc-700">–</span>}
                                    </div>
                                    <span className="text-right text-[10px] text-zinc-500">
                                      {page.volume !== undefined ? formatNumber(page.volume) : '–'}
                                    </span>
                                    <span className={`text-right text-[10px] font-medium ${page.difficulty !== undefined ? difficultyColor(page.difficulty) : 'text-zinc-700'}`}>
                                      {page.difficulty !== undefined ? page.difficulty : '–'}
                                    </span>
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* â”€â”€ Calendar View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {view === 'calendar' && calendar.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {calendar.map((month, mi) => (
            <div key={mi} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{month.month}</p>
                {month.pieces && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {month.pieces.length} pieces
                  </span>
                )}
              </div>
              {month.pieces && month.pieces.length > 0 && (
                <div className="space-y-1">
                  {month.pieces.map((piece, i) => (
                    <div key={i} className="flex items-start gap-2 rounded bg-zinc-800/30 px-2.5 py-1.5">
                      <PriorityDot priority={piece.priority ?? 'medium'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] leading-snug text-zinc-300">{piece.title}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {piece.contentType && <ContentTypeBadge type={piece.contentType} />}
                          {piece.week && <span className="text-[10px] text-zinc-600">Wk {piece.week}</span>}
                          {piece.pillar && <span className="truncate text-[10px] text-zinc-600">{piece.pillar}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* â”€â”€ Linking Architecture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {linking && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Internal Linking Rules</span>
          </div>
          <div className="p-4">
            {linking.strategy && (
              <p className="mb-3 text-[12px] leading-relaxed text-zinc-400">{linking.strategy}</p>
            )}
            {linking.rules && linking.rules.length > 0 && (
              <div className="space-y-2">
                {linking.rules.map((rule, i) => {
                  // Try to split off a "RULE N â€” Title:" prefix for better display
                  const ruleMatch = rule.match(/^(RULE\s+\d+\s*[â€”â€“-]\s*[^:]+):\s*(.+)$/is);
                  return (
                    <div key={i} className="flex gap-3 rounded-md bg-zinc-900/60 px-3 py-2.5">
                      <span className="mt-px shrink-0 text-[10px] font-bold tabular-nums text-zinc-600">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        {ruleMatch ? (
                          <>
                            <p className="text-[11px] font-semibold text-zinc-300">{ruleMatch[1].replace(/^RULE\s+\d+\s*[â€”â€“-]\s*/i, '')}</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{ruleMatch[2]}</p>
                          </>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-zinc-400">{rule.replace(/^â€¢\s*/, '')}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* â”€â”€ Helper Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function StatCard({ label, value, accent, iconPath }: { label: string; value?: number; accent: string; iconPath: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <svg className={`h-5 w-5 shrink-0 ${accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <div>
        <p className="text-lg font-bold tabular-nums text-zinc-100">{value ?? '—'}</p>
        <p className="text-[11px] text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-t px-4 py-2 text-xs font-medium transition-colors ${
        active
          ? 'text-zinc-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-violet-500'
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const map: Record<string, string> = {
    commercial: 'bg-blue-500/10 text-blue-400',
    informational: 'bg-zinc-500/10 text-zinc-400',
    transactional: 'bg-emerald-500/10 text-emerald-400',
    navigational: 'bg-amber-500/10 text-amber-400',
  };
  const key = intent.toLowerCase();
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium capitalize ${map[key] ?? 'bg-zinc-500/10 text-zinc-400'}`}>
      {intent}
    </span>
  );
}

function FunnelBadge({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    TOFU: 'bg-sky-500/10 text-sky-400',
    MOFU: 'bg-violet-500/10 text-violet-400',
    BOFU: 'bg-emerald-500/10 text-emerald-400',
  };
  const key = stage.toUpperCase();
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${map[key] ?? 'bg-zinc-500/10 text-zinc-400'}`}>
      {key}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-zinc-500/10 text-zinc-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium capitalize ${styles[priority.toLowerCase()] ?? styles.low}`}>
      {priority}
    </span>
  );
}

function StatusDot({ done, title }: { done: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`inline-block h-1.5 w-1.5 rounded-full ${done ? 'bg-emerald-400' : 'bg-zinc-700'}`}
    />
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-zinc-600' };
  return <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[priority.toLowerCase()] ?? colors.low}`} />;
}

function ContentTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    pillar: 'Pillar',
    'pillar page': 'Pillar',
    'cluster-hub': 'Hub',
    'cluster hub': 'Hub',
    'cluster page': 'Cluster',
    supporting: 'Support',
    'supporting article': 'Support',
    resource: 'Resource',
    blog: 'Blog',
    faq: 'FAQ',
    landing: 'Landing',
  };
  return (
    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
      {labels[type.toLowerCase()] ?? type}
    </span>
  );
}

function difficultyColor(d: number): string {
  if (d >= 60) return 'text-red-400';
  if (d >= 30) return 'text-amber-400';
  return 'text-emerald-400';
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return 'â€”';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}


interface PageItem {
  title: string;
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  funnelStage?: string;
  contentType?: string;
  estimatedWordCount?: number;
  effort?: string;
  suggestedUrl?: string;
  linksTo?: string[];
  linksFrom?: string[];
}

interface Cluster {
  id: string;
  name: string;
  hubKeyword?: string;
  hubUrl?: string;
  intent?: string;
  priority?: string;
  pages?: PageItem[];
}

interface Pillar {
  id: string;
  name: string;
  description?: string;
  pillarPageKeyword?: string;
  pillarPageUrl?: string;
  estimatedTotalVolume?: number;
  clusters?: Cluster[];
}

interface CalendarMonth {
  month: string;
  pieces?: Array<{ title: string; keyword?: string; pillar?: string; cluster?: string; contentType?: string; priority?: string; week?: number }>;
}
