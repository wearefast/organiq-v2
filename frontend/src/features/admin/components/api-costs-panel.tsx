'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, RefreshCw, ChevronDown, ChevronRight, TrendingUp, Zap, DollarSign, Activity } from 'lucide-react';
import {
  getApiUsageSummary,
  getApiUsageByProject,
  getApiUsageProjectBreakdown,
  downloadApiUsageCsv,
  type ApiUsageSummary,
  type ProjectCost,
  type ProjectBreakdownRow,
} from '../services/admin.service';

// ─── Constants ────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  anthropic:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  openai:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  perplexity: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  ahrefs:     'bg-violet-500/20 text-violet-300 border-violet-500/30',
  dataforseo: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  serper:     'bg-pink-500/20 text-pink-300 border-pink-500/30',
  firecrawl:  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  pagespeed:  'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};
const PROVIDER_COLOR_DEFAULT = 'bg-zinc-700/50 text-zinc-400 border-zinc-600';

const DATE_PRESETS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function providerBadge(provider: string) {
  const cls = PROVIDER_COLORS[provider] ?? PROVIDER_COLOR_DEFAULT;
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {provider}
    </span>
  );
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 }).format(value);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

function shortId(id: string) {
  return id.slice(0, 8) + '…';
}

// ─── Step Table ───────────────────────────────────────────────

function StepTable({ rows }: { rows: ProjectBreakdownRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-zinc-700">
          <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Process / Step</th>
          <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Provider</th>
          <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Model / Endpoint</th>
          <th className="px-3 py-1.5 text-right font-medium text-zinc-500">Calls</th>
          <th className="px-3 py-1.5 text-right font-medium text-zinc-500">Tokens In</th>
          <th className="px-3 py-1.5 text-right font-medium text-zinc-500">Tokens Out</th>
          <th className="px-3 py-1.5 text-right font-medium text-zinc-500">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/20">
            <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-300">{r.stepKey || '—'}</td>
            <td className="px-3 py-1.5">{providerBadge(r.provider)}</td>
            <td className="max-w-[160px] truncate px-3 py-1.5 text-zinc-400">{r.endpoint}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-zinc-300">{fmtNum(r.calls)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">{r.tokensIn != null ? fmtNum(r.tokensIn) : '—'}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">{r.tokensOut != null ? fmtNum(r.tokensOut) : '—'}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-medium text-violet-300">{usd(r.costUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Project Drill-Down ───────────────────────────────────────

function ProjectDrillDown({ projectId, from, to }: { projectId: string; from: string; to: string }) {
  const [rows, setRows] = useState<ProjectBreakdownRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getApiUsageProjectBreakdown(projectId, { from, to })
      .then((data) => { if (active) { setRows(data); setLoading(false); } })
      .catch((err) => { if (active) { setError((err as Error).message); setLoading(false); } });
    return () => { active = false; };
  }, [projectId, from, to]);

  if (loading) return <div className="flex items-center gap-2 py-3 text-xs text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading breakdown…</div>;
  if (error) return <p className="py-2 text-xs text-red-400">{error}</p>;
  if (!rows?.length) return <p className="py-2 text-xs text-zinc-500">No API calls logged for this project in this date range.</p>;

  // Separate workflow runs from direct feature calls
  const byRun = new Map<string, ProjectBreakdownRow[]>();
  const directCalls: ProjectBreakdownRow[] = [];

  for (const row of rows) {
    if (row.workflowRunId) {
      if (!byRun.has(row.workflowRunId)) byRun.set(row.workflowRunId, []);
      byRun.get(row.workflowRunId)!.push(row);
    } else {
      directCalls.push(row);
    }
  }

  const toggleRun = (id: string) => setExpandedRuns((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const runTotal = (runRows: ProjectBreakdownRow[]) =>
    runRows.reduce((s, r) => s + r.costUsd, 0);

  return (
    <div className="space-y-3">
      {/* Workflow Runs */}
      {byRun.size > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Workflow Runs ({byRun.size})</p>
          <div className="space-y-1">
            {[...byRun.entries()].map(([runId, runRows]) => {
              const expanded = expandedRuns.has(runId);
              const total = runTotal(runRows);
              const calls = runRows.reduce((s, r) => s + r.calls, 0);
              // Derive providers used
              const providers = [...new Set(runRows.map((r) => r.provider))];
              return (
                <div key={runId} className="rounded border border-zinc-800 bg-zinc-900/40">
                  <button
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/30"
                    onClick={() => toggleRun(runId)}
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? <ChevronDown className="h-3 w-3 text-zinc-400" /> : <ChevronRight className="h-3 w-3 text-zinc-500" />}
                      <span className="font-mono text-[11px] text-zinc-300">{shortId(runId)}</span>
                      <span className="text-[10px] text-zinc-500">{calls} calls</span>
                      <div className="flex gap-1">{providers.map((p) => providerBadge(p))}</div>
                    </div>
                    <span className="font-semibold text-white">{usd(total)}</span>
                  </button>
                  {expanded && (
                    <div className="overflow-x-auto border-t border-zinc-800 px-2 py-1">
                      <StepTable rows={runRows} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Feature Calls (business profile, on-demand agents, forum search) */}
      {directCalls.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Feature Calls (business profile, on-demand agents, forum search)
          </p>
          <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-900/40">
            <StepTable rows={directCalls} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Row ──────────────────────────────────────────────

function ProjectRow({ project, from, to }: { project: ProjectCost; from: string; to: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-zinc-800 hover:bg-zinc-800/30"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-zinc-400" /> : <ChevronRight className="h-3 w-3 flex-shrink-0 text-zinc-500" />}
            <div>
              <p className="font-medium text-zinc-200">{project.projectName}</p>
              <p className="text-[10px] text-zinc-500">{project.workspaceName}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{fmtNum(project.runs)}</td>
        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{fmtNum(project.calls)}</td>
        <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">{usd(project.costUsd)}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-zinc-800">
          <td colSpan={4} className="bg-zinc-900/50 px-6 py-4">
            <ProjectDrillDown projectId={project.projectId} from={from} to={to} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface ApiCostsPanelProps {
  orgs: Array<{ id: string; name: string }>;
}

export function ApiCostsPanel({ orgs }: ApiCostsPanelProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [presetDays, setPresetDays] = useState(30);
  const [summary, setSummary] = useState<ApiUsageSummary | null>(null);
  const [projects, setProjects] = useState<ProjectCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const dateParams = useCallback(() => {
    const to = new Date();
    const from = new Date(Date.now() - presetDays * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [presetDays]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { orgId: selectedOrgId || undefined, ...dateParams() };
      const [s, p] = await Promise.all([
        getApiUsageSummary(params),
        getApiUsageByProject(params),
      ]);
      setSummary(s);
      setProjects(p);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, dateParams]);

  useEffect(() => { load(); }, [load]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadApiUsageCsv({ orgId: selectedOrgId || undefined, ...dateParams() });
    } finally {
      setExporting(false);
    }
  }

  const topProvider = summary?.byProvider[0]?.provider ?? '—';

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
        >
          <option value="">All organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>

        <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPresetDays(p.days)}
              className={`px-3 py-2 text-sm transition-colors ${presetDays === p.days ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {loading && !summary ? (
        <div className="flex items-center gap-2 py-12 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading API usage data…
        </div>
      ) : summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Total Cost', value: usd(summary.totalCostUsd), icon: DollarSign, color: 'text-violet-400' },
              { label: 'Top API', value: topProvider, icon: TrendingUp, color: 'text-orange-400' },
              { label: 'Total Calls', value: fmtNum(summary.totalCalls), icon: Activity, color: 'text-blue-400' },
              { label: 'Cost / Call', value: summary.totalCalls > 0 ? usd(summary.totalCostUsd / summary.totalCalls) : '$0', icon: Zap, color: 'text-emerald-400' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <p className="text-xs text-zinc-500">{card.label}</p>
                </div>
                <p className="text-xl font-bold text-white truncate">{card.value}</p>
              </div>
            ))}
          </div>

          {/* By Provider Table */}
          {summary.byProvider.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">Cost by Provider</h3>
              <div className="overflow-hidden rounded-xl border border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-800/50">
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Provider</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">Calls</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">Tokens In</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">Tokens Out</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byProvider.map((row) => (
                      <tr key={row.provider} className="border-b border-zinc-800 last:border-0">
                        <td className="px-4 py-3">{providerBadge(row.provider)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{fmtNum(row.calls)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{row.tokensIn > 0 ? fmtNum(row.tokensIn) : '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{row.tokensOut > 0 ? fmtNum(row.tokensOut) : '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">{usd(row.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily Cost Table */}
          {summary.byDay.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">Daily Spend by Provider</h3>
              <div className="max-h-64 overflow-y-auto overflow-x-auto rounded-xl border border-zinc-700">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-800">
                    <tr className="border-b border-zinc-700">
                      <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Date</th>
                      <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Provider</th>
                      <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Calls</th>
                      <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byDay.map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800 last:border-0">
                        <td className="px-4 py-2 tabular-nums text-zinc-400">{row.date}</td>
                        <td className="px-4 py-2">{providerBadge(row.provider)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-zinc-400">{fmtNum(row.calls)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-zinc-300">{usd(row.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-Project Breakdown */}
          {projects.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">Cost by Project</h3>
              <p className="mb-3 text-xs text-zinc-500">Click a row to see the per-step API cost breakdown for recent calls.</p>
              <div className="overflow-hidden rounded-xl border border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-800/50">
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Project</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">Runs</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">API Calls</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => <ProjectRow key={p.projectId} project={p} from={dateParams().from} to={dateParams().to} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.totalCalls === 0 && (
            <div className="py-12 text-center text-sm text-zinc-500">
              No API usage data for this period. Run a workflow to start tracking costs.
            </div>
          )}
        </>
      )}
    </div>
  );
}
