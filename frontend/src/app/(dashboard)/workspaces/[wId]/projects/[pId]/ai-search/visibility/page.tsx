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
  fetchPromptSuggestions,
  PromptWithStats,
  VisibilityOverview,
  PromptHistoryEntry,
  PromptSuggestion,
} from '@/features/analytics/services/prompt-visibility.service';

// ─── Constants ───────────────────────────────────────────────

const ENGINES = ['perplexity', 'openai', 'gemini', 'claude', 'copilot'];

// ─── Engine Logo Component ────────────────────────────────────

function EngineLogo({ engine, size = 16 }: { engine: string; size?: number }) {
  const s = size;
  if (engine === 'perplexity') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-label="Perplexity">
        <path d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z"/>
      </svg>
    );
  }
  if (engine === 'openai') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-label="OpenAI">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
      </svg>
    );
  }
  if (engine === 'gemini') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-label="Gemini">
        <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
      </svg>
    );
  }
  if (engine === 'claude') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-label="Claude">
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
      </svg>
    );
  }
  if (engine === 'copilot') {
    // Microsoft Copilot — colorful sparkle mark
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-label="Copilot">
        <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5z" fill="#0078D4"/>
        <path d="M15.5 8.5c0-.83-.67-1.5-1.5-1.5H10c-.83 0-1.5.67-1.5 1.5v1h1.5V8.5h4V10H10c-.83 0-1.5.67-1.5 1.5v4c0 .83.67 1.5 1.5 1.5h4c.83 0 1.5-.67 1.5-1.5V13H14v2h-4v-3h4c.83 0 1.5-.67 1.5-1.5v-3z" fill="white"/>
      </svg>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 text-zinc-300 text-[9px] font-bold">
      {engine[0].toUpperCase()}
    </span>
  );
}

function EngineBadge({ engine }: { engine: string }) {
  const styles: Record<string, string> = {
    perplexity: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    openai: 'bg-zinc-100/5 text-zinc-200 border-zinc-100/10',
    gemini: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    claude: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    copilot: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${styles[engine] ?? 'bg-zinc-700/50 text-zinc-400 border-zinc-700'}`}>
      <EngineLogo engine={engine} size={12} />
      {engine}
    </span>
  );
}

// ─── Main page ───────────────────────────────────────────────

export default function VisibilityPage() {
  const params = useParams();
  const projectId = params.pId as string;

  const [prompts, setPrompts] = useState<PromptWithStats[]>([]);
  const [overview, setOverview] = useState<VisibilityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [prefillText, setPrefillText] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFailed, setSuggestionsFailed] = useState(false);

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

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsFailed(false);
    try {
      const s = await fetchPromptSuggestions(projectId);
      if (s && s.length > 0) {
        setSuggestions(s);
      } else {
        setSuggestionsFailed(true);
      }
    } catch {
      setSuggestionsFailed(true);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && prompts.length === 0) loadSuggestions();
  }, [loading, prompts.length, loadSuggestions]);

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
          <div className="h-8 bg-zinc-800 rounded w-1/3" />
          <div className="h-64 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Prompt Visibility</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Track your brand&apos;s presence in AI engine responses
          </p>
        </div>
        <button
          onClick={() => { setPrefillText(''); setShowAdd(!showAdd); }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          {showAdd ? 'Cancel' : '+ Add Prompt'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddPromptForm
          projectId={projectId}
          initialText={prefillText}
          onCreated={(p) => { setPrompts((prev) => [p, ...prev]); setShowAdd(false); }}
        />
      )}

      {/* Overview score */}
      {overview && overview.totalPrompts > 0 && (
        <OverviewCard overview={overview} />
      )}

      {/* Prompts table */}
      {prompts.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
            <p className="text-zinc-400 font-medium">No tracked prompts yet</p>
            <p className="text-zinc-500 text-xs mt-1">Pick a starter below or use &ldquo;+ Add Prompt&rdquo; to write your own</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-zinc-500">Suggested prompts based on your business profile</p>
              <button
                onClick={loadSuggestions}
                disabled={suggestionsLoading}
                className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 flex items-center gap-1"
              >
                <svg className={`w-3 h-3 ${suggestionsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Regenerate
              </button>
            </div>
            {suggestionsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-lg border border-zinc-800 p-4 space-y-2 animate-pulse">
                    <div className="h-4 bg-zinc-800 rounded w-1/3" />
                    <div className="h-4 bg-zinc-800 rounded w-full" />
                    <div className="h-3 bg-zinc-800 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : suggestionsFailed ? (
              <div className="rounded-lg border border-zinc-800 p-6 text-center">
                <p className="text-zinc-500 text-sm">Could not generate suggestions.</p>
                <button
                  onClick={loadSuggestions}
                  className="mt-3 px-4 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 p-6 text-center">
                <p className="text-zinc-500 text-sm">Click &ldquo;Regenerate&rdquo; to generate prompts tailored to your business profile.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {suggestions.map((sp) => (
                  <button
                    key={sp.text}
                    onClick={() => { setPrefillText(sp.text); setShowAdd(true); }}
                    className="text-left rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 hover:bg-zinc-800/50 transition-colors group"
                  >
                    <span className="inline-block text-xs font-medium text-violet-400 bg-violet-500/10 group-hover:bg-violet-500/15 px-2 py-0.5 rounded mb-2">
                      {sp.category}
                    </span>
                    <p className="text-sm text-zinc-100 font-medium leading-snug">{sp.text}</p>
                    <p className="text-xs text-zinc-500 mt-1.5 capitalize">{sp.intent}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] uppercase text-zinc-500">Prompt</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase text-zinc-500">Visibility %</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase text-zinc-500">Position</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase text-zinc-500">Engines</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase text-zinc-500">Last Checked</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {prompts.map((p) => (
                <tr key={p.id} className={`hover:bg-zinc-800/30 ${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewHistory(p.id)}
                      className="text-left text-violet-400 hover:underline font-medium"
                    >
                      {p.promptText.length > 60 ? p.promptText.slice(0, 60) + '...' : p.promptText}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-100">
                    {p.latestVisibilityPct != null ? `${p.latestVisibilityPct}%` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {p.latestMentionPosition != null ? `#${p.latestMentionPosition}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.engines.map((e) => <EngineBadge key={e} engine={e} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button
                      onClick={() => handleToggle(p.id, p.isActive)}
                      title={p.isActive ? 'Pause' : 'Resume'}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 transition-colors"
                    >
                      {p.isActive ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="5" width="4" height="14" rx="1"/>
                          <rect x="14" y="5" width="4" height="14" rx="1"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Delete"
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 3h6l1 1h4v2H4V4h4L9 3zm-4 5h14l-1 13H6L5 8zm5 2v9h1v-9H10zm3 0v9h1v-9h-1z"/>
                      </svg>
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
  initialText = '',
  onCreated,
}: {
  projectId: string;
  initialText?: string;
  onCreated: (p: PromptWithStats) => void;
}) {
  const [text, setText] = useState(initialText);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const created = await createPrompt(projectId, {
        promptText: text.trim(),
        engines: ENGINES,
      });
      onCreated(created as unknown as PromptWithStats);
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Prompt text</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. best SEO tool for SaaS companies"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-600 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        Checked against:
        <div className="flex gap-1.5 flex-wrap">
          {ENGINES.map((eng) => <EngineBadge key={eng} engine={eng} />)}
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
  const scoreColor = overview.overallScore >= 60 ? 'text-green-400' : overview.overallScore >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
      <div className="flex items-center gap-8">
        <div className="text-center">
          <div className={`text-4xl font-bold ${scoreColor}`}>{overview.overallScore}</div>
          <div className="text-xs text-zinc-500 mt-1">Visibility Score</div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-4">
          <div>
            <div className="text-lg font-semibold text-zinc-100">{overview.avgVisibilityPct}%</div>
            <div className="text-xs text-zinc-500">Mention Rate</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              {overview.avgPosition ? `#${overview.avgPosition}` : '-'}
            </div>
            <div className="text-xs text-zinc-500">Avg Position</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">{overview.activePrompts}</div>
            <div className="text-xs text-zinc-500">Active Prompts</div>
          </div>
        </div>
      </div>

      {/* Engine breakdown */}
      {overview.byEngine.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="text-xs font-medium text-zinc-500 mb-2">Visibility by Engine</div>
          <div className="flex gap-4">
            {overview.byEngine.map((e) => (
              <div key={e.engine} className="flex items-center gap-2">
                <EngineBadge engine={e.engine} />
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
    <div className="bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100">Check History</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{promptText}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">&times;</button>
      </div>

      {history.length === 0 ? (
        <div className="p-6 text-center text-zinc-500 text-sm">No checks yet. Results appear after the next scheduled run.</div>
      ) : (
        <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
          {history.map((h) => (
            <div key={h.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <EngineBadge engine={h.aiEngine} />
                <span className={`text-xs font-medium ${h.brandMentioned ? 'text-green-400' : 'text-red-400'}`}>
                  {h.brandMentioned ? '✓ Mentioned' : '✗ Not found'}
                </span>
                {h.mentionPosition && (
                  <span className="text-xs text-zinc-500">Position #{h.mentionPosition}</span>
                )}
                {h.sentiment && (
                  <span className="text-xs text-zinc-600 capitalize">{h.sentiment}</span>
                )}
                <span className="ml-auto text-xs text-zinc-500">
                  {new Date(h.checkedAt).toLocaleDateString()}
                </span>
              </div>
              {h.responseExcerpt && (
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{h.responseExcerpt}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
