'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  fetchPrompts,
  createPrompt,
  deletePrompt,
  togglePrompt,
  fetchVisibilityOverview,
  fetchPromptHistory,
  PromptWithStats,
  VisibilityOverview,
  PromptHistoryEntry,
} from '@/features/analytics/services/prompt-visibility.service';

// ─── Constants ───────────────────────────────────────────────

const ENGINES = ['perplexity', 'openai', 'gemini', 'claude', 'copilot'];
const INTENT_STAGES = ['awareness', 'consideration', 'decision'];

const ENGINE_COLORS: Record<string, string> = {
  perplexity: 'bg-purple-100 text-purple-700',
  openai: 'bg-green-100 text-green-700',
  gemini: 'bg-blue-100 text-blue-700',
  claude: 'bg-orange-100 text-orange-700',
  copilot: 'bg-cyan-100 text-cyan-700',
};

// ─── Main page ───────────────────────────────────────────────

export default function VisibilityPage() {
  const params = useParams();
  const projectId = params.pId as string;

  const [prompts, setPrompts] = useState<PromptWithStats[]>([]);
  const [overview, setOverview] = useState<VisibilityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([
        fetchPrompts(projectId),
        fetchVisibilityOverview(projectId),
      ]);
      setPrompts(p);
      setOverview(o);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (promptId: string) => {
    await deletePrompt(projectId, promptId);
    setPrompts((prev) => prev.filter((p) => p.id !== promptId));
  };

  const handleToggle = async (promptId: string, isActive: boolean) => {
    await togglePrompt(projectId, promptId, !isActive);
    setPrompts((prev) => prev.map((p) => p.id === promptId ? { ...p, isActive: !isActive } : p));
  };

  const handleViewHistory = async (promptId: string) => {
    setSelectedPrompt(promptId);
    const h = await fetchPromptHistory(projectId, promptId);
    setHistory(h);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prompt Visibility</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track your brand&apos;s presence in AI engine responses
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          {showAdd ? 'Cancel' : '+ Add Prompt'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddPromptForm
          projectId={projectId}
          onCreated={(p) => { setPrompts((prev) => [p, ...prev]); setShowAdd(false); }}
        />
      )}

      {/* Overview score */}
      {overview && overview.totalPrompts > 0 && (
        <OverviewCard overview={overview} />
      )}

      {/* Prompts table */}
      {prompts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No tracked prompts yet. Add your first prompt to start monitoring AI visibility.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Prompt</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Intent</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Visibility %</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Position</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Engines</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Last Checked</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prompts.map((p) => (
                <tr key={p.id} className={`${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewHistory(p.id)}
                      className="text-left text-indigo-600 hover:underline font-medium"
                    >
                      {p.promptText.length > 60 ? p.promptText.slice(0, 60) + '...' : p.promptText}
                    </button>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{p.intentStage ?? '-'}</td>
                  <td className="px-4 py-3 font-semibold">
                    {p.latestVisibilityPct != null ? `${p.latestVisibilityPct}%` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {p.latestMentionPosition != null ? `#${p.latestMentionPosition}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.engines.map((e) => (
                        <span key={e} className={`px-1.5 py-0.5 text-xs rounded ${ENGINE_COLORS[e] ?? 'bg-gray-100 text-gray-600'}`}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleToggle(p.id, p.isActive)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {p.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History drawer */}
      {selectedPrompt && (
        <HistoryPanel
          history={history}
          promptText={prompts.find((p) => p.id === selectedPrompt)?.promptText ?? ''}
          onClose={() => setSelectedPrompt(null)}
        />
      )}
    </div>
  );
}

// ─── Add Prompt Form ─────────────────────────────────────────

function AddPromptForm({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: (p: PromptWithStats) => void;
}) {
  const [text, setText] = useState('');
  const [intent, setIntent] = useState('awareness');
  const [engines, setEngines] = useState<string[]>(['perplexity', 'openai']);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const created = await createPrompt(projectId, {
        promptText: text.trim(),
        intentStage: intent,
        engines,
      });
      onCreated(created as unknown as PromptWithStats);
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prompt text</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. best SEO tool for SaaS companies"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Intent stage</label>
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {INTENT_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Engines</label>
          <div className="flex gap-2 flex-wrap">
            {ENGINES.map((eng) => (
              <label key={eng} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={engines.includes(eng)}
                  onChange={(e) => {
                    if (e.target.checked) setEngines((prev) => [...prev, eng]);
                    else setEngines((prev) => prev.filter((x) => x !== eng));
                  }}
                  className="rounded border-gray-300"
                />
                {eng}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !text.trim()}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Adding...' : 'Add Prompt'}
      </button>
    </form>
  );
}

// ─── Overview Card ───────────────────────────────────────────

function OverviewCard({ overview }: { overview: VisibilityOverview }) {
  const scoreColor = overview.overallScore >= 60 ? 'text-green-600' : overview.overallScore >= 30 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center gap-8">
        <div className="text-center">
          <div className={`text-4xl font-bold ${scoreColor}`}>{overview.overallScore}</div>
          <div className="text-xs text-gray-500 mt-1">Visibility Score</div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">{overview.avgVisibilityPct}%</div>
            <div className="text-xs text-gray-500">Mention Rate</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {overview.avgPosition ? `#${overview.avgPosition}` : '-'}
            </div>
            <div className="text-xs text-gray-500">Avg Position</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{overview.activePrompts}</div>
            <div className="text-xs text-gray-500">Active Prompts</div>
          </div>
        </div>
      </div>

      {/* Engine breakdown */}
      {overview.byEngine.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs font-medium text-gray-500 mb-2">Visibility by Engine</div>
          <div className="flex gap-4">
            {overview.byEngine.map((e) => (
              <div key={e.engine} className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-xs rounded ${ENGINE_COLORS[e.engine] ?? 'bg-gray-100 text-gray-600'}`}>
                  {e.engine}
                </span>
                <span className="text-sm font-medium">{e.visibilityPct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Panel ───────────────────────────────────────────

function HistoryPanel({
  history,
  promptText,
  onClose,
}: {
  history: PromptHistoryEntry[];
  promptText: string;
  onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Check History</h3>
          <p className="text-xs text-gray-500 mt-0.5">{promptText}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
      </div>

      {history.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">No checks yet. Results appear after the next scheduled run.</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {history.map((h) => (
            <div key={h.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`px-1.5 py-0.5 text-xs rounded ${ENGINE_COLORS[h.aiEngine] ?? 'bg-gray-100'}`}>
                  {h.aiEngine}
                </span>
                <span className={`text-xs font-medium ${h.brandMentioned ? 'text-green-600' : 'text-red-500'}`}>
                  {h.brandMentioned ? '✓ Mentioned' : '✗ Not found'}
                </span>
                {h.mentionPosition && (
                  <span className="text-xs text-gray-500">Position #{h.mentionPosition}</span>
                )}
                {h.sentiment && (
                  <span className="text-xs text-gray-400 capitalize">{h.sentiment}</span>
                )}
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(h.checkedAt).toLocaleDateString()}
                </span>
              </div>
              {h.responseExcerpt && (
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{h.responseExcerpt}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
