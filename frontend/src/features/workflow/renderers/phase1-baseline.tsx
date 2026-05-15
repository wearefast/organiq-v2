'use client';

import { useState } from 'react';
import { InfoTip } from '@/shared/components';

interface CurrentRankings {
  total: number;
  top3: number;
  top10: number;
  top20: number;
  top100: number;
  topKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    difficulty: number;
    url: string;
    intent: string;
  }>;
}

interface QuickWin {
  keyword: string;
  currentPosition: number;
  volume: number;
  difficulty: number;
  url: string;
  estimatedTrafficGain: number;
  action: string;
}

interface CompetitorOverlap {
  competitor: string;
  sharedKeywords: number;
  uniqueToCompetitor: number;
  uniqueToUs: number;
  overlapPercentage: number;
}

interface Phase1BaselineData {
  currentRankings?: CurrentRankings;
  quickWins?: QuickWin[];
  competitorOverlap?: CompetitorOverlap[];
  intentDistribution?: Record<string, { count: number; volume: number; percentage: number }>;
  summary?: {
    totalKeywordUniverse: number;
    currentVisibility: number;
    estimatedTraffic: number;
    quickWinPotential: number;
    gapOpportunity: number;
  };
  [key: string]: unknown;
}

/**
 * Normalize agent output: field names may differ from interface.
 * Agent uses: currentRankingKeywords, quickWinOpportunities, keywordOverlapAnalysis,
 *   keywordGapsVsCompetitors, searchIntentDistribution
 */
function normalizeBaseline(raw: Record<string, unknown>): Phase1BaselineData {
  const result: Phase1BaselineData = {};

  // Map quickWinOpportunities → quickWins
  const qwRaw = (raw.quickWins ?? raw.quickWinOpportunities) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(qwRaw) && qwRaw.length > 0) {
    result.quickWins = qwRaw.map((qw) => ({
      keyword: String(qw.keyword ?? qw.metric ?? ''),
      currentPosition: Number(qw.currentPosition ?? qw.position ?? 0),
      volume: Number(qw.volume ?? 0),
      difficulty: Number(qw.difficulty ?? 0),
      url: String(qw.url ?? ''),
      estimatedTrafficGain: Number(qw.estimatedTrafficGain ?? qw.difference ?? 0),
      action: String(qw.action ?? `Beat ${qw.competitor ?? 'competitor'}`),
    }));
  }

  // Map searchIntentDistribution → intentDistribution
  const intentRaw = (raw.intentDistribution ?? raw.searchIntentDistribution) as Record<string, unknown> | undefined;
  if (intentRaw && typeof intentRaw === 'object') {
    const entries = Object.entries(intentRaw);
    const total = entries.reduce((s, [, v]) => s + Number(v ?? 0), 0);
    const mapped: Record<string, { count: number; volume: number; percentage: number }> = {};
    for (const [intent, val] of entries) {
      const count = Number(val ?? 0);
      mapped[intent] = { count, volume: count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 };
    }
    result.intentDistribution = mapped;
  }

  // Map keywordOverlapAnalysis → competitorOverlap
  const overlapRaw = (raw.competitorOverlap ?? raw.keywordOverlapAnalysis) as Record<string, unknown> | undefined;
  if (overlapRaw && typeof overlapRaw === 'object') {
    const overlap = (overlapRaw as Record<string, unknown>).overlapWithCompetitors ?? (overlapRaw as Record<string, unknown>).overlap;
    if (Array.isArray(overlap)) {
      result.competitorOverlap = overlap.map((co: Record<string, unknown>) => ({
        competitor: String(co.competitor ?? co.domain ?? ''),
        sharedKeywords: Number(co.sharedKeywords ?? co.shared ?? 0),
        uniqueToCompetitor: Number(co.uniqueToCompetitor ?? 0),
        uniqueToUs: Number(co.uniqueToUs ?? 0),
        overlapPercentage: Number(co.overlapPercentage ?? co.overlap ?? 0),
      }));
    }
  }

  // Map keywordGapsVsCompetitors summary (legacy field name)
  const gapsRaw = raw.keywordGapsVsCompetitors as Record<string, unknown> | undefined;
  if (gapsRaw?.summary && typeof gapsRaw.summary === 'string') {
    result.summary = {
      totalKeywordUniverse: 0,
      currentVisibility: 0,
      estimatedTraffic: 0,
      quickWinPotential: result.quickWins?.length ?? 0,
      gapOpportunity: 0,
    };
    (result as Record<string, unknown>)._gapSummary = gapsRaw.summary;
  }

  // Map keywordGaps array (current schema field name)
  const gapsArray = raw.keywordGaps as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(gapsArray) && gapsArray.length > 0) {
    (result as Record<string, unknown>)._gapSummary =
      `${gapsArray.length} keyword gap${gapsArray.length !== 1 ? 's' : ''} identified vs competitors.`;
    (result as Record<string, unknown>)._gapKeywords = gapsArray
      .slice(0, 10)
      .map((g) => String(g.keyword ?? ''))
      .filter(Boolean);
  }

  // Pass through dataGaps notices from agent
  if (Array.isArray(raw.dataGaps)) {
    (result as Record<string, unknown>).dataGaps = raw.dataGaps;
  }

  // Preserve any matching fields from raw
  if (raw.currentRankings) result.currentRankings = raw.currentRankings as CurrentRankings;
  if (raw.summary && typeof raw.summary === 'object') result.summary = raw.summary as Phase1BaselineData['summary'];

  // Backfill quickWinPotential from quickWins count if agent omitted it
  if (result.summary && (result.summary.quickWinPotential === undefined || result.summary.quickWinPotential === null)) {
    result.summary = { ...result.summary, quickWinPotential: result.quickWins?.length ?? 0 };
  }

  return result;
}

export function Phase1BaselineRenderer({ data }: { data: unknown }) {
  const baseline = data && typeof data === 'object'
    ? normalizeBaseline(data as Record<string, unknown>)
    : (data as Phase1BaselineData);

  if (!baseline || typeof baseline !== 'object') {
    return <p className="text-sm text-zinc-500">No baseline data available.</p>;
  }

  const gapSummary = (baseline as Record<string, unknown>)._gapSummary as string | undefined;
  const gapKeywords = (baseline as Record<string, unknown>)._gapKeywords as string[] | undefined;
  const dataGaps = (baseline as Record<string, unknown>).dataGaps as string[] | undefined;

  return (
    <div className="space-y-6">
      {/* Ranking Distribution */}
      {baseline.currentRankings && (
        <div>
          <SectionLabel>Current Ranking Distribution</SectionLabel>
          <div className="mt-2 grid grid-cols-5 gap-2">
            <RankBucket label="Top 3" count={baseline.currentRankings.top3} color="text-emerald-400" tip="Keywords ranking in positions 1–3" />
            <RankBucket label="Top 10" count={baseline.currentRankings.top10} color="text-green-400" tip="Keywords on page 1 of search results" />
            <RankBucket label="Top 20" count={baseline.currentRankings.top20} color="text-yellow-400" tip="Keywords ranking in positions 1–20" />
            <RankBucket label="Top 100" count={baseline.currentRankings.top100} color="text-orange-400" tip="Keywords ranking in the top 100 results" />
            <RankBucket label="Total" count={baseline.currentRankings.total} color="text-zinc-300" tip="Total trackable keywords for your site" />
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      {baseline.summary && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Keyword Universe" value={formatNumber(baseline.summary.totalKeywordUniverse)} tip="Total trackable keywords for your niche" />
          <MetricCard label="Est. Traffic" value={formatNumber(baseline.summary.estimatedTraffic)} tip="Estimated monthly organic traffic" />
          <MetricCard label="Quick Win Potential" value={formatNumber(baseline.summary.quickWinPotential)} tip="Keywords close to ranking on page 1" />
        </div>
      )}

      {/* Quick Wins */}
      {baseline.quickWins && baseline.quickWins.length > 0 ? (
        <SortableQuickWinsTable quickWins={baseline.quickWins} />
      ) : (
        <div>
          <SectionLabel>Quick Wins</SectionLabel>
          <p className="mt-2 text-sm text-zinc-500">No quick win opportunities found. Keywords ranking positions 4–20 with KD &lt; 40 will appear here once Ahrefs ranking data is available for this domain.</p>
        </div>
      )}

      {/* Intent Distribution */}
      {baseline.intentDistribution && (
        <div>
          <SectionLabel>Intent Distribution</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Object.entries(baseline.intentDistribution).map(([intent, data]) => (
              <div key={intent} className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-500">{intent}</p>
                <p className="text-sm font-semibold text-zinc-100">{data.percentage}%</p>
                <p className="text-[10px] text-zinc-500">{formatNumber(data.volume)} vol</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Overlap */}
      {baseline.competitorOverlap && baseline.competitorOverlap.length > 0 && (
        <div>
          <SectionLabel>Competitor Overlap</SectionLabel>
          <div className="mt-2 space-y-2">
            {baseline.competitorOverlap.map((co, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <span className="text-sm text-zinc-200">{co.competitor}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-400">{co.sharedKeywords} shared</span>
                  <span className="text-red-400">+{co.uniqueToCompetitor} gaps</span>
                  <span className="text-emerald-400">+{co.uniqueToUs} unique</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{co.overlapPercentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      <div>
        <SectionLabel>Gap Analysis</SectionLabel>
        {gapSummary ? (
          <>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">{gapSummary}</p>
            {gapKeywords && gapKeywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gapKeywords.map((kw, i) => (
                  <span key={i} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{kw}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No competitor keyword gaps identified. Requires competitor-metrics data from Step 7.</p>
        )}
      </div>

      {/* Data Gaps notice */}
      {dataGaps && dataGaps.length > 0 && (
        <div className="rounded border border-amber-800/40 bg-amber-500/5 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">Data Gaps</p>
          <ul className="mt-1 space-y-0.5">
            {dataGaps.map((gap, i) => (
              <li key={i} className="text-sm text-amber-400/80">{gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SortableQuickWinsTable({ quickWins }: { quickWins: QuickWin[] }) {
  type SK = 'keyword' | 'currentPosition' | 'volume' | 'difficulty' | 'estimatedTrafficGain';
  const [sortKey, setSortKey] = useState<SK>('estimatedTrafficGain');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SK) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'keyword' ? 'asc' : 'desc'); }
  };

  const sorted = [...quickWins].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SK) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (align: string) => `cursor-pointer select-none px-3 py-2 text-[10px] uppercase text-zinc-500 hover:text-zinc-300 ${align}`;

  return (
    <div>
      <SectionLabel>Quick Wins ({quickWins.length})</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className={th('text-left')} onClick={() => handleSort('keyword')}><InfoTip tip="Term you currently rank for">Keyword{arrow('keyword')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('currentPosition')}><InfoTip tip="Current SERP position">Pos{arrow('currentPosition')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('volume')}><InfoTip tip="Monthly search volume">Volume{arrow('volume')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('difficulty')}><InfoTip tip="Keyword Difficulty (0–100)">KD{arrow('difficulty')}</InfoTip></th>
              <th className={th('text-right')} onClick={() => handleSort('estimatedTrafficGain')}><InfoTip tip="Est. traffic if moved to position #1">Traffic Gain{arrow('estimatedTrafficGain')}</InfoTip></th>
              <th className="px-3 py-2 text-left text-[10px] uppercase text-zinc-500"><InfoTip tip="Recommended optimization action">Action</InfoTip></th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 15).map((qw, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-200">{qw.keyword}</td>
                <td className="px-3 py-2 text-right text-zinc-300">{qw.currentPosition}</td>
                <td className="px-3 py-2 text-right text-zinc-400">{formatNumber(qw.volume)}</td>
                <td className="px-3 py-2 text-right"><DifficultyBadge value={qw.difficulty} /></td>
                <td className="px-3 py-2 text-right text-emerald-400">+{formatNumber(qw.estimatedTrafficGain)}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{qw.action}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBucket({ label, count, color, tip }: { label: string; count: number; color: string; tip?: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{formatNumber(count)}</p>
      <p className="text-[10px] text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
    </div>
  );
}

function MetricCard({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</p>
      <p className="mt-1 text-xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function DifficultyBadge({ value, showLabel }: { value: number; showLabel?: boolean }) {
  const color = value <= 30 ? 'text-green-400' : value <= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>{showLabel ? 'KD: ' : ''}{Math.round(value)}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
