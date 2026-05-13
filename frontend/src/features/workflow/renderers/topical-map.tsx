'use client';

import { useState } from 'react';

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
  /* Renderer's expected shape */
  pillars?: Pillar[];
  calendar?: CalendarMonth[];
  linkingArchitecture?: { strategy?: string; rules?: string[] };
  /* Agent's actual output shape */
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
  /* Shared */
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

/** Normalize agent output into the renderer's Pillar[] shape */
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

/** Normalize agent output into CalendarMonth[] */
function normalizeCalendar(d: TopicalMapData): CalendarMonth[] {
  if (d.calendar && d.calendar.length > 0) return d.calendar;
  if (!d.contentCalendar) return [];
  return d.contentCalendar.map((cm) => ({
    month: cm.month,
    pieces: (cm.contentPieces ?? []).map((kw) => ({ title: kw, keyword: kw })),
  }));
}

/** Normalize linking architecture */
function normalizeLinking(d: TopicalMapData): { strategy?: string; rules?: string[] } | null {
  if (d.linkingArchitecture) return d.linkingArchitecture;
  if (!d.internalLinkingArchitecture) return null;
  const rules = Object.entries(d.internalLinkingArchitecture).map(
    ([from, tos]) => `${from} → ${tos.join(', ')}`,
  );
  return { strategy: 'Internal linking map between content pieces', rules };
}

/** Compute stats from normalized pillars */
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

export function TopicalMapRenderer({ data }: { data: unknown }) {
  const d = data as TopicalMapData;
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'calendar'>('map');

  if (!d || typeof d !== 'object') {
    return <p className="text-sm text-zinc-500">No topical map data available.</p>;
  }

  const pillars = normalizePillars(d);
  const calendar = normalizeCalendar(d);
  const linking = normalizeLinking(d);
  const stats = computeStats(pillars, d);

  return (
    <div className="space-y-6">
      {/* Summary */}
      {d.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{d.summary}</p>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="flex flex-wrap gap-4 rounded border border-zinc-800 bg-zinc-900/30 px-4 py-2.5">
          <Stat label="Pillars" value={stats.totalPillars} />
          <Stat label="Clusters" value={stats.totalClusters} />
          <Stat label="Pages" value={stats.totalPages} />
          {stats.totalEstimatedWords !== undefined && (
            <Stat label="Est. Words" value={stats.totalEstimatedWords} format />
          )}
          {stats.byPriority && (
            <>
              <span className="text-zinc-700">|</span>
              <Stat label="High" value={stats.byPriority.high} color="text-red-400" />
              <Stat label="Medium" value={stats.byPriority.medium} color="text-amber-400" />
              <Stat label="Low" value={stats.byPriority.low} color="text-zinc-400" />
            </>
          )}
        </div>
      )}

      {/* View Toggle */}
      {(pillars.length > 0 || calendar.length > 0) && (
        <div className="flex gap-1">
          <TabButton active={view === 'map'} onClick={() => setView('map')}>Topical Map</TabButton>
          {calendar.length > 0 && (
            <TabButton active={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</TabButton>
          )}
        </div>
      )}

      {/* Topical Map View */}
      {view === 'map' && pillars.length > 0 && (
        <div className="space-y-2">
          {pillars.map((pillar) => (
            <div key={pillar.id} className="rounded border border-zinc-800 bg-zinc-900/30">
              {/* Pillar Header */}
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/30"
                onClick={() => setExpandedPillar(expandedPillar === pillar.id ? null : pillar.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{expandedPillar === pillar.id ? '▾' : '▸'}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{pillar.name}</p>
                    {pillar.description && (
                      <p className="text-[11px] text-zinc-500">{pillar.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  {pillar.clusters && <span>{pillar.clusters.length} clusters</span>}
                  {pillar.estimatedTotalVolume !== undefined && (
                    <span>{formatNumber(pillar.estimatedTotalVolume)} vol</span>
                  )}
                </div>
              </button>

              {/* Clusters */}
              {expandedPillar === pillar.id && pillar.clusters && (
                <div className="border-t border-zinc-800 px-4 py-2">
                  {pillar.clusters.map((cluster) => (
                    <div key={cluster.id} className="border-b border-zinc-800/50 last:border-0">
                      {/* Cluster Header */}
                      <button
                        className="flex w-full items-center justify-between py-2 text-left hover:bg-zinc-800/20"
                        onClick={() =>
                          setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600">
                            {expandedCluster === cluster.id ? '▾' : '▸'}
                          </span>
                          <span className="text-xs text-zinc-300">{cluster.name}</span>
                          {cluster.priority && <PriorityBadge priority={cluster.priority} />}
                        </div>
                        <span className="text-[10px] text-zinc-600">
                          {cluster.pages?.length ?? 0} pages
                        </span>
                      </button>

                      {/* Pages */}
                      {expandedCluster === cluster.id && cluster.pages && (
                        <div className="ml-5 space-y-1 pb-2">
                          {cluster.pages.map((page, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded bg-zinc-900/50 px-3 py-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-[11px] text-zinc-300">{page.title}</p>
                                  {page.contentType && <ContentTypeBadge type={page.contentType} />}
                                </div>
                                {page.keyword && page.keyword.toLowerCase() !== page.title?.toLowerCase() && (
                                  <p className="text-[10px] text-zinc-600">{page.keyword}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                                {page.volume !== undefined && <span>{formatNumber(page.volume)} vol</span>}
                                {page.difficulty !== undefined && (
                                  <span className={difficultyColor(page.difficulty)}>KD {page.difficulty}</span>
                                )}
                                {page.estimatedWordCount !== undefined && (
                                  <span>{formatNumber(page.estimatedWordCount)} words</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && calendar.length > 0 && (
        <div className="space-y-3">
          {calendar.map((month, mi) => (
            <div key={mi} className="rounded border border-zinc-800 bg-zinc-900/30 p-3">
              <p className="text-xs font-medium text-zinc-300">
                {month.month}
              </p>
              {month.pieces && month.pieces.length > 0 && (
                <div className="mt-2 space-y-1">
                  {month.pieces.map((piece, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded bg-zinc-900/50 px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        {piece.priority && <PriorityDot priority={piece.priority} />}
                        <span className="text-[11px] text-zinc-300">{piece.title}</span>
                        {piece.contentType && <ContentTypeBadge type={piece.contentType} />}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                        {piece.keyword && <span>{piece.keyword}</span>}
                        {piece.week && <span>W{piece.week}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Linking Architecture */}
      {linking && (
        <div>
          <SectionLabel>Internal Linking Strategy</SectionLabel>
          {linking.strategy && (
            <p className="mt-1 text-[11px] text-zinc-400">{linking.strategy}</p>
          )}
          {linking.rules && linking.rules.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {linking.rules.map((rule, i) => (
                <li key={i} className="text-[11px] text-zinc-500">• {rule}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helper Components ─────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}

function Stat({ label, value, format, color }: { label: string; value?: number; format?: boolean; color?: string }) {
  return (
    <div className="text-[11px]">
      <span className="text-zinc-500">{label}: </span>
      <span className={color ?? 'text-zinc-300'}>
        {value !== undefined ? (format ? formatNumber(value) : value) : '—'}
      </span>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
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
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${styles[priority] ?? styles.low}`}>
      {priority}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-zinc-500' };
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[priority] ?? colors.low}`} />;
}

function ContentTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    pillar: 'Pillar',
    'pillar page': 'Pillar',
    'cluster-hub': 'Hub',
    'cluster page': 'Cluster',
    supporting: 'Support',
    'supporting article': 'Support',
    resource: 'Resource',
  };
  return (
    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
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
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
