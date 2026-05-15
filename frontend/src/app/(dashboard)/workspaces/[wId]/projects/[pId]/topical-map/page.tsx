'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/shared/utils/api';
import { fetchContent, type ContentPiece } from '@/features/content/services/content.service';

interface PageItem {
  title: string;
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  funnelStage?: string;
  contentType?: string;
  estimatedWordCount?: number;
  suggestedUrl?: string;
}

interface Cluster {
  id: string;
  name: string;
  hubKeyword?: string;
  intent?: string;
  priority?: string;
  pages?: PageItem[];
}

interface Pillar {
  id: string;
  name: string;
  description?: string;
  pillarPageKeyword?: string;
  estimatedTotalVolume?: number;
  clusters?: Cluster[];
}

interface CalendarPiece {
  title: string;
  keyword?: string;
  pillar?: string;
  cluster?: string;
  contentType?: string;
  priority?: string;
  week?: number;
}

interface CalendarMonth {
  month: number;
  label?: string;
  pieces?: CalendarPiece[];
}

interface TopicalMap {
  id: string;
  name: string;
  pillars: Pillar[];
  calendar?: CalendarMonth[];
  createdAt: string;
}

interface Stats {
  totalMaps: number;
  totalPillars: number;
  totalClusters: number;
  totalPages: number;
}

export default function TopicalMapPage() {
  const params = useParams();
  const projectId = params.pId as string;

  const [maps, setMaps] = useState<TopicalMap[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedMap, setSelectedMap] = useState<TopicalMap | null>(null);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [view, setView] = useState<'tree' | 'calendar'>('tree');
  const [loading, setLoading] = useState(true);
  const [contentByKeyword, setContentByKeyword] = useState<Map<string, ContentPiece>>(new Map());

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [mapsData, statsData, contentData] = await Promise.all([
        apiFetch(`/projects/${projectId}/topical-maps`),
        apiFetch(`/projects/${projectId}/topical-maps/stats`),
        fetchContent(projectId).catch(() => [] as ContentPiece[]),
      ]);
      const mapsList = mapsData as TopicalMap[];
      setMaps(mapsList);
      setStats(statsData as Stats);
      if (mapsList.length > 0 && !selectedMap) {
        setSelectedMap(mapsList[0]);
      }
      // Build keyword → content piece lookup (articles preferred over briefs)
      const lookup = new Map<string, ContentPiece>();
      for (const piece of contentData) {
        const kw = extractKeyword(piece);
        if (!kw) continue;
        const existing = lookup.get(kw);
        if (!existing || piece.type === 'article') {
          lookup.set(kw, piece);
        }
      }
      setContentByKeyword(lookup);
    } catch (e) {
      console.error('Failed to load topical maps', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-zinc-500">No topical maps yet.</p>
        <p className="text-xs text-zinc-600">
          Run the workflow through Step 15 to generate a topical map.
        </p>
      </div>
    );
  }

  const pillars = selectedMap?.pillars ?? [];
  const calendar = selectedMap?.calendar ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-200">Topical Map</h1>
          <p className="text-xs text-zinc-500">
            Content architecture organized into pillars, clusters, and pages
          </p>
        </div>

        {/* Map Selector (if multiple) */}
        {maps.length > 1 && (
          <select
            value={selectedMap?.id ?? ''}
            onChange={(e) => {
              const map = maps.find((m) => m.id === e.target.value);
              if (map) setSelectedMap(map);
            }}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
          >
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex gap-6 rounded border border-zinc-800 bg-zinc-900/30 px-5 py-3">
          <StatItem label="Pillars" value={stats.totalPillars} />
          <StatItem label="Clusters" value={stats.totalClusters} />
          <StatItem label="Content Pieces" value={stats.totalPages} />
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-1">
        <TabButton active={view === 'tree'} onClick={() => setView('tree')}>
          Tree View
        </TabButton>
        <TabButton active={view === 'calendar'} onClick={() => setView('calendar')}>
          Content Calendar
        </TabButton>
      </div>

      {/* Tree View */}
      {view === 'tree' && (
        <div className="space-y-2">
          {pillars.map((pillar) => {
            const isExpanded = expandedPillar === pillar.id;
            const clusterCount = pillar.clusters?.length ?? 0;
            const pageCount =
              pillar.clusters?.reduce((sum, c) => sum + (c.pages?.length ?? 0), 0) ?? 0;

            return (
              <div key={pillar.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40">
                {/* Pillar Row */}
                <button
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-zinc-800/30"
                  onClick={() => setExpandedPillar(isExpanded ? null : pillar.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-violet-500/10 text-xs font-bold text-violet-400">
                      {pillar.name.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{pillar.name}</p>
                      {pillar.description && (
                        <p className="mt-0.5 text-[11px] text-zinc-500">{pillar.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                    <span>{clusterCount} clusters</span>
                    <span>{pageCount} pages</span>
                    {pillar.estimatedTotalVolume !== undefined && (
                      <span>{formatNumber(pillar.estimatedTotalVolume)} vol</span>
                    )}
                    <span className="text-zinc-600">{isExpanded ? '▾' : '▸'}</span>
                  </div>
                </button>

                {/* Clusters */}
                {isExpanded && pillar.clusters && (
                  <div className="border-t border-zinc-800">
                    {pillar.clusters.map((cluster) => {
                      const clusterExpanded = expandedCluster === cluster.id;
                      return (
                        <div key={cluster.id} className="border-b border-zinc-800/50 last:border-0">
                          <button
                            className="flex w-full items-center justify-between px-6 py-2.5 text-left transition-colors hover:bg-zinc-800/20"
                            onClick={() =>
                              setExpandedCluster(clusterExpanded ? null : cluster.id)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-600">
                                {clusterExpanded ? '▾' : '▸'}
                              </span>
                              <span className="text-xs font-medium text-zinc-300">
                                {cluster.name}
                              </span>
                              {cluster.priority && (
                                <PriorityBadge priority={cluster.priority} />
                              )}
                              {cluster.intent && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
                                  {cluster.intent}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-600">
                              {cluster.pages?.length ?? 0} pages
                            </span>
                          </button>

                          {/* Pages */}
                          {clusterExpanded && cluster.pages && (
                            <div className="ml-8 space-y-1 px-4 pb-3">
                              {cluster.pages.map((page, i) => {
                                const matchedContent = contentByKeyword.get(page.keyword?.toLowerCase().trim());
                                return (
                                <div
                                  key={i}
                                  className="flex items-center justify-between rounded bg-zinc-900/60 px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-medium text-zinc-300">
                                      {page.title}
                                    </p>
                                    <div className="mt-0.5 flex gap-2 text-[10px] text-zinc-600">
                                      <span>{page.keyword}</span>
                                      {page.contentType && (
                                        <ContentTypeBadge type={page.contentType} />
                                      )}
                                      {page.funnelStage && (
                                        <span className="uppercase">{page.funnelStage}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                                    {matchedContent && (
                                      <ContentStatusBadge
                                        type={matchedContent.type}
                                        status={matchedContent.status}
                                      />
                                    )}
                                    {page.volume !== undefined && (
                                      <span>{formatNumber(page.volume)} vol</span>
                                    )}
                                    {page.difficulty !== undefined && (
                                      <span className={difficultyColor(page.difficulty)}>
                                        KD {page.difficulty}
                                      </span>
                                    )}
                                    {page.estimatedWordCount !== undefined && (
                                      <span>{formatNumber(page.estimatedWordCount)} words</span>
                                    )}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="space-y-3">
          {calendar.length === 0 ? (
            <p className="text-sm text-zinc-500">No content calendar available.</p>
          ) : (
            calendar.map((month) => (
              <div key={month.month} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-sm font-medium text-zinc-300">
                  {month.label ?? `Month ${month.month}`}
                </p>
                {month.pieces && month.pieces.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    {month.pieces.map((piece, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded bg-zinc-900/60 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          {piece.priority && <PriorityDot priority={piece.priority} />}
                          <span className="text-[11px] text-zinc-300">{piece.title}</span>
                          {piece.contentType && (
                            <ContentTypeBadge type={piece.contentType} />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                          {piece.keyword && <span>{piece.keyword}</span>}
                          {piece.week && <span>W{piece.week}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-600">No pieces scheduled.</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helper Components ─────────────────────── */

function StatItem({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-lg font-semibold text-zinc-200">{value ?? 0}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-zinc-800 text-zinc-200'
          : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-zinc-500/10 text-zinc-400',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${styles[priority] ?? styles.low}`}
    >
      {priority}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-400',
    medium: 'bg-amber-400',
    low: 'bg-zinc-500',
  };
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[priority] ?? colors.low}`}
    />
  );
}

function ContentTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    pillar: 'Pillar',
    'cluster-hub': 'Hub',
    supporting: 'Support',
    resource: 'Resource',
  };
  return (
    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
      {labels[type] ?? type}
    </span>
  );
}

function difficultyColor(d: number): string {
  if (d >= 60) return 'text-red-400';
  if (d >= 30) return 'text-amber-400';
  return 'text-emerald-400';
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function ContentStatusBadge({ type, status }: { type: string; status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-zinc-600 text-zinc-200',
    review: 'bg-yellow-600/80 text-yellow-100',
    approved: 'bg-green-600/80 text-green-100',
    published: 'bg-blue-600/80 text-blue-100',
  };
  const label = type === 'article' ? `Article: ${status}` : `Brief: ${status}`;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${colors[status] ?? colors.draft}`}>
      {label}
    </span>
  );
}

function extractKeyword(piece: ContentPiece): string | undefined {
  // Try briefData.targetKeyword first, then title
  const brief = piece.briefData as Record<string, unknown> | undefined;
  if (brief && typeof brief.targetKeyword === 'string') {
    return brief.targetKeyword.toLowerCase().trim();
  }
  return undefined;
}
