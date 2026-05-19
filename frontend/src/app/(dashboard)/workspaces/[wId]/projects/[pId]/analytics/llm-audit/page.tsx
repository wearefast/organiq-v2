'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  runLlmAudit,
  fetchLatestAudit,
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
  const [url, setUrl] = useState('');
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
    if (!url.trim()) return;
    setRunning(true);
    setError('');
    try {
      const result = await runLlmAudit(projectId, url.trim());
      setAudit(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setRunning(false);
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

      {/* Run form */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Page URL to audit</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={running || !url.trim()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Auditing...' : 'Run Audit'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Results */}
      {!audit ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No audit results yet. Enter a URL above to run your first audit.</p>
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
                  Audited: {new Date(audit.auditedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Section scores summary */}
          {audit.results[0] && (
            <SectionScores result={audit.results[0]} />
          )}

          {/* Bot permission matrix */}
          {audit.results[0] && (
            <BotMatrix permissions={audit.results[0].botPermissions} />
          )}

          {/* Issues / recommendations */}
          {audit.results[0] && audit.results[0].issues.length > 0 && (
            <IssuesList issues={audit.results[0].issues} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section scores ──────────────────────────────────────────

function SectionScores({ result }: { result: AuditRunSummary['results'][0] }) {
  const bots = result.botPermissions;
  const botEntries = Object.values(bots);
  const botScore = Math.round((botEntries.filter((s) => s !== 'blocked').length / botEntries.length) * 25);

  let contentScore = 0;
  if (result.contentChecks.h1Present) contentScore += 6;
  if (result.contentChecks.hierarchyValid) contentScore += 6;
  if (result.contentChecks.metaDescriptionPresent) contentScore += 6;
  if (result.contentChecks.semanticHtml) contentScore += 6;
  if (result.contentChecks.imagesTotal === 0 || result.contentChecks.imagesWithAlt === result.contentChecks.imagesTotal) contentScore += 3;
  if (!result.contentChecks.jsRenderedOnly) contentScore += 3;

  let trustScore = 0;
  if (result.trustSignals.ssl) trustScore += 7;
  if (result.trustSignals.hasAboutPage) trustScore += 3;
  if (result.trustSignals.authorByline) trustScore += 5;
  if (result.trustSignals.schemaTypes.length > 0) trustScore += 5;
  if (result.trustSignals.ogTags) trustScore += 3;
  if (result.trustSignals.twitterTags) trustScore += 2;

  let chunkScore = 0;
  const avg = result.contentChunking.avgParagraphLength;
  if (avg > 0 && avg <= 4) chunkScore += 8;
  else if (avg <= 5) chunkScore += 5;
  if (result.contentChunking.hasLists) chunkScore += 6;
  if (result.contentChunking.internalLinkCount >= 5) chunkScore += 6;
  else if (result.contentChunking.internalLinkCount >= 3) chunkScore += 3;

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

// ─── Bot permission matrix ───────────────────────────────────

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

// ─── Issues list ─────────────────────────────────────────────

function IssuesList({ issues }: { issues: AuditIssue[] }) {
  const sorted = [...issues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900">
          Recommendations ({issues.length} issue{issues.length !== 1 ? 's' : ''})
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {sorted.map((issue, i) => (
          <div key={i} className="px-4 py-3 flex items-start gap-3">
            <SeverityBadge severity={issue.severity} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{issue.description}</p>
              <p className="text-xs text-gray-500 mt-0.5">{issue.fix}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
