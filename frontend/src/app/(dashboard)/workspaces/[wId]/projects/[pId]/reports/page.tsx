'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  fetchReports,
  generateReport,
  deleteReport,
  type Report,
  type GenerateReportPayload,
} from '@/features/reports/services/reports.service';
import { apiFetch } from '@/shared/utils/api';
import {
  FileText,
  Download,
  Trash2,
  Plus,
  BarChart3,
  Search,
  Brain,
  BookOpen,
  Loader2,
} from 'lucide-react';

const REPORT_TYPE_META: Record<Report['type'], { label: string; icon: typeof FileText; color: string }> = {
  full_strategy: { label: 'Full Strategy', icon: BarChart3, color: 'bg-rose-500/10 text-rose-400' },
  ai_visibility: { label: 'AI Visibility', icon: Brain, color: 'bg-purple-500/10 text-purple-400' },
  keyword_research: { label: 'Keyword Research', icon: Search, color: 'bg-blue-500/10 text-blue-400' },
  content_plan: { label: 'Content Plan', icon: BookOpen, color: 'bg-emerald-500/10 text-emerald-400' },
};

interface WorkflowRun {
  id: string;
  status: string;
  createdAt: string;
}

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.pId as string;

  const [reports, setReports] = useState<Report[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedType, setSelectedType] = useState<Report['type']>('full_strategy');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, runsData] = await Promise.all([
        fetchReports(projectId),
        apiFetch<WorkflowRun[]>(`/workflows/project/${projectId}`),
      ]);
      setReports(reportsData);
      setWorkflowRuns(runsData.filter((r) => r.status === 'completed'));
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleGenerate() {
    if (!selectedRunId) return;
    setGenerating(true);
    try {
      const payload: GenerateReportPayload = {
        workflowRunId: selectedRunId,
        type: selectedType,
      };
      await generateReport(projectId, payload);
      setShowGenerate(false);
      setSelectedRunId('');
      await loadData();
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(report: Report) {
    try {
      const res = await apiFetch<{ base64: string; title: string }>(
        `/projects/${projectId}/reports/${report.id}/download`,
      );
      const byteChars = atob(res.base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${res.title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download report:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReport(projectId, id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
        >
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Generate form */}
      {showGenerate && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">New Report</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Workflow Run</label>
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                <option value="">Select a completed run…</option>
                {workflowRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.id.slice(0, 8)} — {new Date(run.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Report Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as Report['type'])}
                className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {Object.entries(REPORT_TYPE_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowGenerate(false)}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!selectedRunId || generating}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {generating && <Loader2 className="h-3 w-3 animate-spin" />}
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Object.entries(REPORT_TYPE_META).map(([type, meta]) => {
          const count = reports.filter((r) => r.type === type).length;
          const Icon = meta.icon;
          return (
            <div key={type} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-2 ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">{meta.label}</p>
                  <p className="text-lg font-bold text-white">{count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/50 py-12">
          <FileText className="mb-3 h-10 w-10 text-zinc-600" />
          <p className="text-sm text-zinc-400">No reports generated yet</p>
          <p className="text-xs text-zinc-500">Generate your first report from a completed workflow run</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const meta = REPORT_TYPE_META[report.type];
            const Icon = meta.icon;
            return (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition hover:border-zinc-600"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{report.title}</p>
                    <p className="text-xs text-zinc-400">
                      {meta.label} · {report.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(report)}
                    className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-700 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
