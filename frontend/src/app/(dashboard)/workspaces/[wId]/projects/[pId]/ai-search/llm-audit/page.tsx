'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  runLlmAudit,
  fetchLatestAudit,
  fetchAuditHistory,
  refreshProjectSitemap,
  AuditRunSummary,
  AuditHistoryEntry,
  AuditIssue,
  BotPermissions,
} from '@/features/analytics/services/llm-audit.service';

// ─── Bot metadata ────────────────────────────────────────────

type BotCategory = 'Training Crawler' | 'Search & Answer' | 'Real-time Fetcher';

const BOT_META: Record<string, { label: string; owner: string; description: string; category: BotCategory }> = {
  // ── Training crawlers ──────────────────────────────────────
  GPTBot: {
    label: 'GPTBot',
    owner: 'OpenAI',
    description: 'Indexes content to train ChatGPT models and populate ChatGPT Search.',
    category: 'Training Crawler',
  },
  ClaudeBot: {
    label: 'ClaudeBot',
    owner: 'Anthropic',
    description: "Indexes content for Claude's model training and knowledge base.",
    category: 'Training Crawler',
  },
  'Google-Extended': {
    label: 'Google-Extended',
    owner: 'Google',
    description: "Opt-out token for Gemini AI training and Google AI Overviews.",
    category: 'Training Crawler',
  },
  'Applebot-Extended': {
    label: 'Applebot-Extended',
    owner: 'Apple',
    description: 'Crawls content specifically for Apple Intelligence model training.',
    category: 'Training Crawler',
  },
  'cohere-ai': {
    label: 'Cohere AI',
    owner: 'Cohere',
    description: 'Enterprise LLM provider — crawls public content for RAG model training.',
    category: 'Training Crawler',
  },
  Bytespider: {
    label: 'Bytespider',
    owner: 'ByteDance (TikTok)',
    description: 'Collects training data for Doubao and other ByteDance LLMs.',
    category: 'Training Crawler',
  },
  // ── Search & answer bots ───────────────────────────────────
  'OAI-SearchBot': {
    label: 'OAI-SearchBot',
    owner: 'OpenAI',
    description: 'Powers ChatGPT Search real-time web index — distinct from training.',
    category: 'Search & Answer',
  },
  PerplexityBot: {
    label: 'PerplexityBot',
    owner: 'Perplexity AI',
    description: "Crawls and indexes pages for Perplexity's AI answer engine.",
    category: 'Search & Answer',
  },
  Applebot: {
    label: 'Applebot',
    owner: 'Apple',
    description: 'Used for Siri Knowledge, Spotlight Suggestions, and Safari Reader.',
    category: 'Search & Answer',
  },
  DuckAssistBot: {
    label: 'DuckAssistBot',
    owner: 'DuckDuckGo',
    description: "Powers DuckDuckGo's AI-assisted answer feature.",
    category: 'Search & Answer',
  },
  'Gemini-Deep-Research': {
    label: 'Gemini Deep Research',
    owner: 'Google',
    description: "Google Gemini's Deep Research agent — scans sources during research queries.",
    category: 'Search & Answer',
  },
  Bravebot: {
    label: 'Bravebot',
    owner: 'Brave',
    description: 'Indexes content for Brave Search AI answers and RAG pipelines.',
    category: 'Search & Answer',
  },
  // ── Real-time user-initiated fetchers ──────────────────────
  'ChatGPT-User': {
    label: 'ChatGPT-User',
    owner: 'OpenAI',
    description: 'Fetches specific URLs when ChatGPT users share or ask about a page.',
    category: 'Real-time Fetcher',
  },
  'Claude-User': {
    label: 'Claude-User',
    owner: 'Anthropic',
    description: 'Fetches pages on demand when Claude users share a link in conversation.',
    category: 'Real-time Fetcher',
  },
  'Perplexity-User': {
    label: 'Perplexity-User',
    owner: 'Perplexity AI',
    description: 'Performs real-time page fetches to answer user queries in Perplexity.',
    category: 'Real-time Fetcher',
  },
  'meta-externalagent': {
    label: 'Meta External Agent',
    owner: 'Meta',
    description: 'Meta AI search crawler used for Meta AI assistant responses.',
    category: 'Real-time Fetcher',
  },
};

// ─── Score helpers ───────────────────────────────────────────

function getGradeLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getBarColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return 'bg-emerald-500';
  if (pct >= 0.6) return 'bg-blue-500';
  if (pct >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Info tooltip ────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center ml-1 cursor-help align-middle">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
      <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-64 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 normal-case font-normal leading-relaxed whitespace-normal shadow-xl">
        {text}
      </span>
    </span>
  );
}

// ─── Bot status badge ────────────────────────────────────────

function BotStatusBadge({ status }: { status: string }) {
  if (status === 'allowed')
    return <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Allowed</span>;
  if (status === 'blocked')
    return <span className="px-2 py-0.5 text-xs rounded bg-red-500/15 text-red-400 border border-red-500/20">Blocked</span>;
  return <span className="px-2 py-0.5 text-xs rounded bg-zinc-700/60 text-zinc-400 border border-zinc-700">Not specified</span>;
}

// ─── Issue severity badge ────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    high: 'bg-red-500/15 text-red-400 border-red-500/20',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    low: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${styles[severity] ?? 'bg-zinc-700/60 text-zinc-400 border-zinc-700'}`}>
      {severity}
    </span>
  );
}

// ─── Sparkline ───────────────────────────────────────────────

function ScoreSparkline({ history }: { history: AuditHistoryEntry[] }) {
  if (history.length < 2) return null;
  // Most-recent entry is history[0]; reverse for left→right chronological order
  const pts = [...history].slice(0, 8).reverse();
  const W = 80, H = 24, PAD = 3;
  const scores = pts.map((h) => h.overallScore);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;
  const xStep = (W - PAD * 2) / (pts.length - 1);
  const cy = (s: number) => (H - PAD) - ((s - minS) / range) * (H - PAD * 2);
  const points = pts.map((h, i) => `${(PAD + i * xStep).toFixed(1)},${cy(h.overallScore).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} className="text-zinc-500 overflow-visible" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {pts.map((h, i) => (
        <circle key={i} cx={PAD + i * xStep} cy={cy(h.overallScore)} r="2" fill="currentColor" />
      ))}
    </svg>
  );
}

// ─── Audit history panel ─────────────────────────────────────

function AuditHistoryPanel({
  history,
  currentRunId,
}: {
  history: AuditHistoryEntry[];
  currentRunId?: string;
}) {
  const [open, setOpen] = useState(false);
  if (history.length <= 1) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors rounded-lg"
      >
        <p className="text-xs font-medium text-zinc-400">Audit History ({history.length} runs)</p>
        <span className="text-zinc-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-zinc-800">
                <th className="px-4 py-2 text-xs font-medium text-zinc-500">Date</th>
                <th className="px-4 py-2 text-xs font-medium text-zinc-500 text-right">Score</th>
                <th className="px-4 py-2 text-xs font-medium text-zinc-500 text-right">Δ</th>
                <th className="px-4 py-2 text-xs font-medium text-zinc-500 text-right">Pages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {history.map((entry, i) => {
                const delta = i < history.length - 1 ? entry.overallScore - history[i + 1].overallScore : null;
                const isCurrent = entry.auditRunId === currentRunId;
                return (
                  <tr key={entry.auditRunId} className={isCurrent ? 'bg-zinc-800/30' : 'hover:bg-zinc-800/20 transition-colors'}>
                    <td className="px-4 py-2 text-zinc-400 text-xs">
                      {new Date(entry.auditedAt).toLocaleString()}
                      {isCurrent && <span className="ml-2 text-[10px] text-zinc-500 italic">current</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-semibold tabular-nums text-sm ${getScoreColor(entry.overallScore)}`}>
                        {entry.overallScore}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {delta !== null ? (
                        <span className={delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'}>
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500 tabular-nums text-xs">{entry.pageCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Score cap detection ─────────────────────────────────────
// Priority bots: blocking any of these triggers the hard cap in the backend scoring model.
// Must stay in sync with LlmAuditService.PRIORITY_BOTS.
const PRIORITY_BOTS_UI = ['GPTBot', 'ClaudeBot', 'OAI-SearchBot', 'PerplexityBot', 'Google-Extended'] as const;

// ─── Main page ──────────────────────────────────────────────────

export default function LlmAuditPage() {
  const params = useParams();
  const projectId = params.pId as string;

  const [audit, setAudit] = useState<AuditRunSummary | null>(null);
  const [history, setHistory] = useState<AuditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAudit = useCallback(async () => {
    try {
      const [data, hist] = await Promise.all([
        fetchLatestAudit(projectId),
        fetchAuditHistory(projectId).catch(() => [] as AuditHistoryEntry[]),
      ]);
      setAudit(data);
      setHistory(hist ?? []);
    } catch {
      // No audit yet
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const handleRun = async () => {
    setRunning(true);
    setError('');
    try {
      const result = await runLlmAudit(projectId);
      setAudit(result);
      // Refresh history so the new run appears in the trend
      fetchAuditHistory(projectId).then((hist) => setHistory(hist ?? [])).catch(() => undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setRunning(false);
    }
  };

  const handleRefreshSitemap = async () => {
    setRefreshing(true);
    setError('');
    try {
      await refreshProjectSitemap(projectId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sitemap refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 bg-zinc-800 rounded w-1/3" />
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-28 bg-zinc-800 rounded" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-zinc-800 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">LLM Crawlability Audit</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Check if your pages are accessible and optimised for AI crawlers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshSitemap}
            disabled={refreshing || running}
            title="Re-crawl the sitemap to pick up newly added or removed pages"
            className="rounded-md px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh Sitemap'}
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded-md px-3 py-1.5 text-xs bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Auditing…' : 'Run Audit'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2">
          {error}
        </p>
      )}

      {/* Empty state */}
      {!audit ? (
        <div className="rounded-lg border border-dashed border-zinc-700 p-12 text-center">
          <p className="text-sm text-zinc-500">
            No audit results yet.{' '}
            <button onClick={handleRun} disabled={running} className="text-zinc-300 hover:text-white underline underline-offset-2">
              Run Audit
            </button>{' '}
            to analyse up to 25 pages from your sitemap.
          </p>
        </div>
      ) : (
        <div data-tour="audit-results" className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 flex items-center gap-6">
            <div className="text-center shrink-0">
              <div className={`text-5xl font-bold tabular-nums ${getScoreColor(audit.overallScore)}`}>
                {audit.overallScore}
              </div>
              <div className={`text-xs font-medium mt-1 ${getScoreColor(audit.overallScore)}`}>
                {getGradeLabel(audit.overallScore)} / 100
              </div>
              {/* Δ vs previous run */}
              {(() => {
                const prev = history.find((h) => h.auditRunId !== audit.auditRunId);
                if (!prev) return null;
                const delta = audit.overallScore - prev.overallScore;
                const color = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500';
                return (
                  <div className={`text-xs font-medium mt-1 ${color}`}>
                    {delta > 0 ? '↑ +' : delta < 0 ? '↓ ' : ''}{delta} vs prev
                  </div>
                );
              })()}
              {/* Score sparkline */}
              {history.length >= 2 && (
                <div className="mt-2 flex justify-center">
                  <ScoreSparkline history={history} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">AI Indexability Score</p>
              <p className="text-xs text-zinc-500 mt-1">
                Based on bot permissions, content structure, trust signals, and content chunking
              </p>
              <p className="text-xs text-zinc-600 mt-2">
                {audit.pageCount} page{audit.pageCount !== 1 ? 's' : ''} audited
                {' · '}
                {new Date(audit.auditedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Score cap warning — shown when a priority bot block or noindex directive has capped the score */}
          {(() => {
            const firstResult = audit.results[0];
            if (!firstResult) return null;
            const hasBlockedPriorityBot = PRIORITY_BOTS_UI.some((b) => firstResult.botPermissions[b] === 'blocked');
            const isPageBlocked = firstResult.trustSignals.metaRobotsNoindex === true || firstResult.trustSignals.xRobotsNoindex === true;
            if (!(hasBlockedPriorityBot || isPageBlocked) || audit.overallScore > 40) return null;
            return (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
                <span className="text-amber-400 shrink-0 text-sm">⚠</span>
                <p className="text-sm text-amber-300/80">
                  <span className="font-medium text-amber-400">Score capped at 40 — </span>
                  {hasBlockedPriorityBot
                    ? 'A priority AI bot (GPTBot / ClaudeBot / PerplexityBot) is blocked in robots.txt.'
                    : 'Page has a noindex directive (meta robots or X-Robots-Tag).'}
                  {' Fix the blocking condition to unlock full scoring.'}
                </p>
              </div>
            );
          })()}

          {/* Section scores */}
          {audit.results.length > 0 && <SectionScores results={audit.results} />}

          {/* Bot matrix */}
          {audit.results[0] && <BotMatrix permissions={audit.results[0].botPermissions} />}

          {/* Per-page breakdown */}
          {audit.results.length > 1 && <PageBreakdown results={audit.results} />}

          {/* Recommendations */}
          {audit.results.length > 0 && (
            <AggregatedIssues results={audit.results} totalPages={audit.pageCount} />
          )}

          {/* Audit history trend */}
          <AuditHistoryPanel history={history} currentRunId={audit.auditRunId} />
        </div>
      )}
    </div>
  );
}

function SectionScores({ results }: { results: AuditRunSummary['results'] }) {
  const n = results.length;

  const bots = results[0].botPermissions;
  const botEntries = Object.values(bots);
  const allowedCount = botEntries.filter((s) => s === 'allowed').length;
  const notSpecifiedCount = botEntries.filter((s) => s === 'not_specified').length;
  const botScore = Math.round((allowedCount + notSpecifiedCount * 0.5) / botEntries.length * 20);

  const contentScore = Math.round(
    results.reduce((sum, r) => {
      let s = 0;
      if (r.contentChecks.h1Present) s += 5;
      if (r.contentChecks.hierarchyValid) s += 5;
      if (r.contentChecks.metaDescriptionPresent) s += 5;
      if (r.contentChecks.semanticHtml) s += 5;
      if (r.contentChecks.imagesTotal === 0 || r.contentChecks.imagesWithAlt === r.contentChecks.imagesTotal) s += 2;
      if (!r.contentChecks.jsRenderedOnly) s += 3;
      return sum + s;
    }, 0) / n,
  );

  const trustScore = Math.round(
    results.reduce((sum, r) => {
      let s = 0;
      if (r.trustSignals.ssl) s += 7;
      if (r.trustSignals.hasAboutPage) s += 3;
      if (r.trustSignals.authorByline) s += 5;
      if (r.trustSignals.schemaTypes.length > 0) s += 5;
      if (r.trustSignals.ogTags) s += 3;
      if (r.trustSignals.twitterTags) s += 2;
      return sum + s;
    }, 0) / n,
  );

  const chunkScore = Math.round(
    results.reduce((sum, r) => {
      let s = 0;
      const avg = r.contentChunking.avgParagraphLength;
      if (avg > 0 && avg <= 4) s += 8;
      else if (avg <= 5) s += 5;
      if (r.contentChunking.hasLists) s += 6;
      if (r.contentChunking.internalLinkCount >= 5) s += 6;
      else if (r.contentChunking.internalLinkCount >= 3) s += 3;
      return sum + s;
    }, 0) / n,
  );

  const first = results[0]?.contentChecks;
  const llmsScore = (first?.llmsTxtPresent ? 5 : 0) + (first?.llmsTxtValid ? 3 : 0) + (first?.pageInLlmsTxt ? 2 : 0) + (first?.llmsFullTxtPresent ? 2 : 0);

  const freshnessScore = Math.round(
    results.reduce((sum, r) => {
      let s = 0;
      if (r.contentChecks.dateModifiedPresent && r.contentChecks.dateModifiedRecent) s += 4;
      if (r.contentChecks.sitemapHasLastmod) s += 3;
      return sum + s;
    }, 0) / n,
  );

  const citationScore = Math.round(
    results.reduce((sum, r) => {
      let s = 0;
      if (r.contentChunking.hasFaq) s += 5;
      if (r.contentChunking.hasComparisonTable) s += 4;
      if (r.contentChunking.hasStepList) s += 4;
      if (r.contentChunking.answerFirst) s += 4;
      if (r.contentChunking.hasOutboundLinks) s += 3;
      return sum + s;
    }, 0) / n,
  );

  const eeaatScore = Math.round(
    results.reduce((sum, r) => {
      let s = 0;
      if (r.trustSignals.hasPersonSchema) s += 4;
      if (r.trustSignals.hasOrganizationSchema) s += 2;
      if (r.trustSignals.authorHasCredentials) s += 2;
      return sum + s;
    }, 0) / n,
  );

  const sections = [
    { label: 'Bot Permissions', score: botScore, max: 20 },
    { label: 'Content Structure', score: contentScore, max: 25 },
    { label: 'Trust Signals', score: trustScore, max: 25 },
    { label: 'Content Chunking', score: chunkScore, max: 20 },
    { label: 'LLM Discovery', score: llmsScore, max: 12 },
    { label: 'Freshness', score: freshnessScore, max: 7 },
    { label: 'Citation Readiness', score: citationScore, max: 20 },
    { label: 'E-E-A-T', score: eeaatScore, max: 8 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {sections.map((s) => (
        <div key={s.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
          <div className={`text-2xl font-bold tabular-nums ${getScoreColor((s.score / s.max) * 100)}`}>
            {s.score}<span className="text-sm font-normal text-zinc-600">/{s.max}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
          <div className="mt-2 w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${getBarColor(s.score, s.max)}`}
              style={{ width: `${(s.score / s.max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BotMatrix({ permissions }: { permissions: BotPermissions }) {
  const bots = Object.entries(permissions) as [string, string][];

  // Group by category; bots not in BOT_META fall under 'Other'
  const categories: BotCategory[] = ['Training Crawler', 'Search & Answer', 'Real-time Fetcher'];
  const grouped = categories.map((cat) => ({
    category: cat,
    bots: bots.filter(([key]) => BOT_META[key]?.category === cat),
  })).filter((g) => g.bots.length > 0);

  const other = bots.filter(([key]) => !BOT_META[key]);

  const categoryColors: Record<BotCategory, string> = {
    'Training Crawler': 'text-violet-400',
    'Search & Answer': 'text-sky-400',
    'Real-time Fetcher': 'text-teal-400',
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-xs font-medium text-zinc-400">LLM Bot Access Matrix</p>
        <p className="text-xs text-zinc-600 mt-0.5">
          Derived from your site&apos;s <code className="text-zinc-500">robots.txt</code>. Blocking these bots prevents your content from appearing in AI-generated answers.
        </p>
      </div>
      {grouped.map((group) => (
        <div key={group.category}>
          <div className="px-4 py-1.5 bg-zinc-800/40 border-b border-zinc-800/60">
            <span className={`text-[11px] font-medium uppercase tracking-wide ${categoryColors[group.category]}`}>
              {group.category}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {group.bots.map(([botKey, status]) => {
              const meta = BOT_META[botKey];
              return (
                <div key={botKey} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-200">{meta?.label ?? botKey}</span>
                      <span className="text-xs text-zinc-500">{meta?.owner}</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">{meta?.description}</p>
                  </div>
                  <BotStatusBadge status={status} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {other.length > 0 && (
        <div>
          <div className="px-4 py-1.5 bg-zinc-800/40 border-b border-zinc-800/60">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Other</span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {other.map(([botKey, status]) => (
              <div key={botKey} className="px-4 py-3 flex items-center gap-4">
                <span className="flex-1 text-sm text-zinc-400">{botKey}</span>
                <BotStatusBadge status={status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PageBreakdown({ results }: { results: AuditRunSummary['results'] }) {
  const sorted = [...results].sort((a, b) => b.aiIndexabilityScore - a.aiIndexabilityScore);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-xs font-medium text-zinc-400">Page Breakdown ({results.length} pages)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-zinc-800">
              <th className="px-4 py-2 text-xs font-medium text-zinc-500">URL</th>
              <th className="px-4 py-2 text-xs font-medium text-zinc-500 text-right">
                <span className="inline-flex items-center justify-end gap-0.5">
                  Score
                  <InfoTooltip text="AI Indexability Score (0–100). Measures how well each page can be discovered, read, and cited by AI crawlers and LLMs. Checks bot permissions, content structure, trust signals, and chunking quality. 80+ Excellent · 60–79 Good · 40–59 Needs Work · below 40 Poor." />
                </span>
              </th>
              <th className="px-4 py-2 text-xs font-medium text-zinc-500 text-right">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {sorted.map((r) => (
              <tr key={r.pageUrl} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-2 text-zinc-400 max-w-xs">
                  <a
                    href={r.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-zinc-200 block truncate transition-colors"
                    title={r.pageUrl}
                  >
                    {r.pageUrl.replace(/^https?:\/\//, '')}
                  </a>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={`font-semibold tabular-nums ${getScoreColor(r.aiIndexabilityScore)}`}>
                    {r.aiIndexabilityScore}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-zinc-500 tabular-nums">{r.issues.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AggregatedIssues({
  results,
  totalPages,
}: {
  results: AuditRunSummary['results'];
  totalPages: number;
}) {
  const issueMap = new Map<string, { issue: AuditIssue; pages: number }>();
  for (const r of results) {
    for (const issue of r.issues) {
      const existing = issueMap.get(issue.description);
      if (existing) {
        existing.pages++;
      } else {
        issueMap.set(issue.description, { issue, pages: 1 });
      }
    }
  }

  const deduped = Array.from(issueMap.values()).sort((a, b) => b.pages - a.pages);

  if (deduped.length === 0) return null;

  const high   = deduped.filter((d) => d.issue.severity === 'high');
  const medium = deduped.filter((d) => d.issue.severity === 'medium');
  const low    = deduped.filter((d) => d.issue.severity === 'low');

  const columns = [
    { title: 'High',   dot: 'bg-red-500',   label: 'text-red-400',   items: high   },
    { title: 'Medium', dot: 'bg-amber-500',  label: 'text-amber-400', items: medium },
    { title: 'Low',    dot: 'bg-blue-500',   label: 'text-blue-400',  items: low    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500 px-0.5">
        Recommendations — {deduped.length} issue{deduped.length !== 1 ? 's' : ''}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {columns.map(({ title, dot, label, items }) => (
          <div key={title} className="rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              <p className={`text-xs font-medium ${label}`}>{title}</p>
              <span className="ml-auto text-xs tabular-nums text-zinc-600">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-xs text-zinc-600 text-center">No {title.toLowerCase()} issues</p>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {items.map(({ issue, pages }, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-zinc-200 flex-1">{issue.description}</p>
                      {totalPages > 1 && (
                        <span className="text-xs text-zinc-600 shrink-0 mt-0.5 tabular-nums">
                          {pages}/{totalPages}p
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{issue.fix}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
