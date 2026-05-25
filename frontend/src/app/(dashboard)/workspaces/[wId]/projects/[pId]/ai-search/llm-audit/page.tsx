'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  runLlmAudit,
  fetchLatestAudit,
  refreshProjectSitemap,
  AuditRunSummary,
  AuditIssue,
  BotPermissions,
} from '@/features/analytics/services/llm-audit.service';

// ─── Score gauge helpers ─────────────────────────────────────

function getGradeLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

function getGradeColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function getGaugeBg(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-blue-100';
  if (score >= 40) return 'bg-yellow-100';
  return 'bg-red-100';
}

// ─── Bot status badge ────────────────────────────────────────

function BotStatusBadge({ status }: { status: string }) {
  if (status === 'allowed')
    return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">Allowed</span>;
  if (status === 'blocked')
    return <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">Blocked</span>;
  return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">Not specified</span>;
}

// ─── Issue severity badge ────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${colors[severity] ?? 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  );
}

// ─── Main page ───────────────────────────────────────────────

export default function LlmAuditPage() {
  const params = useParams();
  const projectId = params.pId as string;

  const [audit, setAudit] = useState<AuditRunSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAudit = useCallback(async () => {
    try {
      const data = await fetchLatestAudit(projectId);
      setAudit(data);
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
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LLM Crawlability Audit</h1>
        <p className="text-sm text-gray-500 mt-1">
          Check if your pages are accessible and optimized for AI crawlers
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={running}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Auditing…' : 'Run Audit'}
        </button>
        <button
          onClick={handleRefreshSitemap}
          disabled={refreshing || running}
          title="Re-crawl the sitemap to pick up newly added or removed pages"
          className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? 'Refreshing…' : 'Refresh Sitemap'}
        </button>
        <p className="text-xs text-gray-400 ml-1">
          Audits up to 25 pages discovered from your site&apos;s sitemap
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Results */}
      {!audit ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No audit results yet. Click <strong>Run Audit</strong> to analyse your site.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Score gauge */}
          <div className={`rounded-lg p-6 ${getGaugeBg(audit.overallScore)}`}>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-5xl font-bold ${getGradeColor(audit.overallScore)}`}>
                  {audit.overallScore}
                </div>
                <div className={`text-sm font-medium mt-1 ${getGradeColor(audit.overallScore)}`}>
                  {getGradeLabel(audit.overallScore)}/100
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">AI Indexability Score</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Based on bot permissions, content structure, trust signals, and content chunking
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {audit.pageCount} page{audit.pageCount !== 1 ? 's' : ''} audited
                  {' · '}{new Date(audit.auditedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Section scores — averaged across all pages */}
          {audit.results.length > 0 && (
            <SectionScores results={audit.results} />
          )}

          {/* Bot permission matrix — site-wide, same for all pages */}
          {audit.results[0] && (
            <BotMatrix permissions={audit.results[0].botPermissions} />
          )}

          {/* Per-page score breakdown (only shown when >1 page was audited) */}
          {audit.results.length > 1 && (
            <PageBreakdown results={audit.results} />
          )}

          {/* Aggregated issues — deduped across all pages */}
          {audit.results.length > 0 && (
            <AggregatedIssues results={audit.results} totalPages={audit.pageCount} />
          )}
        </div>
      )}
    </div>
  );
}

function SectionScores({ results }: { results: AuditRunSummary['results'] }) {
  const n = results.length;

  const bots = results[0].botPermissions;
  const botEntries = Object.values(bots);
  const botScore = Math.round((botEntries.filter((s) => s !== 'blocked').length / botEntries.length) * 25);

  const contentScore = Math.round(
    results.reduce((sum, r) => {
      let s = 0;
      if (r.contentChecks.h1Present) s += 6;
      if (r.contentChecks.hierarchyValid) s += 6;
      if (r.contentChecks.metaDescriptionPresent) s += 6;
      if (r.contentChecks.semanticHtml) s += 6;
      if (r.contentChecks.imagesTotal === 0 || r.contentChecks.imagesWithAlt === r.contentChecks.imagesTotal) s += 3;
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

  const sections = [
    { label: 'Bot Permissions', score: botScore, max: 25 },
    { label: 'Content Structure', score: contentScore, max: 30 },
    { label: 'Trust Signals', score: trustScore, max: 25 },
    { label: 'Content Chunking', score: chunkScore, max: 20 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {sections.map((s) => (
        <div key={s.label} className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{s.score}/{s.max}</div>
          <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${(s.score / s.max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PageBreakdown({ results }: { results: AuditRunSummary['results'] }) {
  const sorted = [...results].sort((a, b) => b.aiIndexabilityScore - a.aiIndexabilityScore);
  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900">Page Breakdown ({results.length} pages)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="px-4 py-2">URL</th>
              <th className="px-4 py-2 text-right">Score</th>
              <th className="px-4 py-2 text-right">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r) => (
              <tr key={r.pageUrl} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700 max-w-xs">
                  <a
                    href={r.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-indigo-600 block truncate"
                    title={r.pageUrl}
                  >
                    {r.pageUrl.replace(/^https?:\/\//, '')}
                  </a>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={`font-semibold ${getGradeColor(r.aiIndexabilityScore)}`}>
                    {r.aiIndexabilityScore}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-500">{r.issues.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BotMatrix({ permissions }: { permissions: BotPermissions }) {
  const bots = Object.entries(permissions) as [string, string][];
  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900">LLM Bot Access Matrix</h3>
      </div>
      <div className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-2">Bot</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bots.map(([bot, status]) => (
              <tr key={bot}>
                <td className="py-2 font-medium text-gray-900">{bot}</td>
                <td className="py-2"><BotStatusBadge status={status} /></td>
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

  const deduped = Array.from(issueMap.values()).sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const diff = (order[a.issue.severity] ?? 3) - (order[b.issue.severity] ?? 3);
    return diff !== 0 ? diff : b.pages - a.pages;
  });

  if (deduped.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900">
          Recommendations ({deduped.length} issue{deduped.length !== 1 ? 's' : ''})
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {deduped.map(({ issue, pages }, i) => (
          <div key={i} className="px-4 py-3 flex items-start gap-3">
            <SeverityBadge severity={issue.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <p className="text-sm font-medium text-gray-900 flex-1">{issue.description}</p>
                {totalPages > 1 && (
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {pages}/{totalPages} pages
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{issue.fix}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
