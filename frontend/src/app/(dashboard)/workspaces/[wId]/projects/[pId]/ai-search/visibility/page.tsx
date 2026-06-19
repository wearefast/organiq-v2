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
  runPromptCheck,
  PromptWithStats,
  EngineStats,
  VisibilityOverview,
  PromptHistoryEntry,
  PromptSuggestion,
} from '@/features/analytics/services/prompt-visibility.service';
import { apiFetch } from '@/shared/utils/api';

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
  const [runningChecks, setRunningChecks] = useState<Set<string>>(new Set());
  const [pendingResultIds, setPendingResultIds] = useState<Set<string>>(new Set());
  const [scheduleHour, setScheduleHour] = useState(4);
  const [scheduleDraft, setScheduleDraft] = useState(4);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, o, sch] = await Promise.all([
        fetchPrompts(projectId),
        fetchVisibilityOverview(projectId),
        apiFetch<{ hour: number; nextRun: string | null }>(`/projects/${projectId}/prompts/schedule`).catch(() => ({ hour: 4, nextRun: null })),
      ]);
      setPrompts(p);
      setOverview(o);
      setScheduleHour(sch.hour);
      setScheduleDraft(sch.hour);
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

  const handleScheduleSave = async () => {
    setScheduleSaving(true);
    try {
      const res = await apiFetch<{ hour: number }>(`/projects/${projectId}/prompts/schedule`, {
        method: 'PATCH',
        body: JSON.stringify({ hour: scheduleDraft }),
      });
      setScheduleHour(res.hour);
      setScheduleEditing(false);
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleRunCheck = async (promptId: string) => {
    setRunningChecks((prev) => new Set(prev).add(promptId));
    setPendingResultIds((prev) => new Set(prev).add(promptId));
    try {
      await runPromptCheck(projectId, promptId);
    } catch {
      // job not queued — clear pending state
      setPendingResultIds((prev) => { const next = new Set(prev); next.delete(promptId); return next; });
    } finally {
      setRunningChecks((prev) => { const next = new Set(prev); next.delete(promptId); return next; });
      // Jobs take up to 60s (3 majority-vote calls × 2 working engines)
      // Poll every 15s, give up after 90s
      let elapsed = 0;
      const interval = setInterval(async () => {
        elapsed += 15;
        await load();
        if (elapsed >= 90) {
          clearInterval(interval);
          setPendingResultIds((prev) => { const next = new Set(prev); next.delete(promptId); return next; });
        }
      }, 15_000);
    }
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
          data-tour="add-prompt-btn"
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
          onCreated={async (created) => {
            setShowAdd(false);
            setPendingResultIds((prev) => new Set(prev).add(created.id));
            await load();
            let elapsed = 0;
            const interval = setInterval(async () => {
              elapsed += 15;
              await load();
              if (elapsed >= 90) {
                clearInterval(interval);
                setPendingResultIds((prev) => { const next = new Set(prev); next.delete(created.id); return next; });
              }
            }, 15_000);
          }}
        />
      )}

      {/* Overview score */}
      {overview && overview.totalPrompts > 0 && (
        <OverviewCard overview={overview} />
      )}

      {/* Scheduler */}
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-500">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="text-xs text-zinc-400 font-medium shrink-0">Daily schedule</span>
        {scheduleEditing ? (
          <div className="flex items-center gap-2">
            <select
              value={scheduleDraft}
              onChange={(e) => setScheduleDraft(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-800 text-zinc-100 text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC</option>
              ))}
            </select>
            <button
              onClick={handleScheduleSave}
              disabled={scheduleSaving}
              className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {scheduleSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setScheduleEditing(false); setScheduleDraft(scheduleHour); }}
              className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span className="text-xs text-zinc-300 tabular-nums">{String(scheduleHour).padStart(2, '0')}:00 UTC</span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">
              Next run: {(() => {
                const now = new Date();
                const next = new Date();
                next.setUTCHours(scheduleHour, 0, 0, 0);
                if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
                const isToday = next.toDateString() === now.toDateString();
                return `${isToday ? 'today' : 'tomorrow'} ${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              })()}
            </span>
            <button
              onClick={() => setScheduleEditing(true)}
              className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          </>
        )}
      </div>

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
        <div data-tour="tracked-prompts" className="space-y-3">
          {prompts.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              running={runningChecks.has(p.id)}
              pendingResults={pendingResultIds.has(p.id)}
              scheduleHour={scheduleHour}
              onToggle={() => handleToggle(p.id, p.isActive)}
              onDelete={() => handleDelete(p.id)}
              onViewHistory={() => handleViewHistory(p.id)}
              onRunCheck={() => handleRunCheck(p.id)}
            />
          ))}
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

// ─── Info Tooltip ────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center ml-1 cursor-help align-middle">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-64 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 normal-case font-normal leading-relaxed whitespace-normal shadow-xl">
        {text}
      </span>
    </span>
  );
}

// ─── Sentiment Badge ─────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' | null }) {
  if (!sentiment) return <span className="text-zinc-600 text-xs">—</span>;
  const styles = {
    positive: 'text-green-400 bg-green-500/10 border-green-500/20',
    neutral: 'text-zinc-400 bg-zinc-700/40 border-zinc-600/30',
    negative: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  const icons = { positive: '↑', neutral: '→', negative: '↓' };
  const titles = {
    positive: 'Positive — the AI mentions your brand with favorable language (e.g. best, top, leading, recommended, trusted)',
    neutral: 'Neutral — the AI mentions your brand without strong positive or negative framing',
    negative: 'Negative — the AI mentions your brand with unfavorable language (e.g. avoid, poor, limited, problematic)',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs capitalize ${styles[sentiment]}`}
      title={titles[sentiment]}
    >
      <span className="text-[10px]">{icons[sentiment]}</span>
      {sentiment}
    </span>
  );
}

// ─── Prompt Card ─────────────────────────────────────────────

function PromptCard({
  prompt,
  running,
  pendingResults,
  scheduleHour,
  onToggle,
  onDelete,
  onViewHistory,
  onRunCheck,
}: {
  prompt: PromptWithStats;
  running: boolean;
  pendingResults: boolean;
  scheduleHour: number;
  onToggle: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
  onRunCheck: () => void;
}) {
  const intentColors: Record<string, string> = {
    awareness: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    consideration: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    decision: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  };

  const [activeResponse, setActiveResponse] = useState<{ engine: string; text: string } | null>(null);

  return (
    <div className={`rounded-lg border border-zinc-800 bg-zinc-900/60 overflow-hidden ${!prompt.isActive ? 'opacity-60' : ''}`}>
      {/* Card header */}
      <div className="px-4 py-3 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {prompt.intentStage && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] uppercase font-medium ${intentColors[prompt.intentStage] ?? 'bg-zinc-700/40 text-zinc-400 border-zinc-600'}`}>
                {prompt.intentStage}
              </span>
            )}
            <button
              onClick={onViewHistory}
              className="text-sm font-medium text-zinc-100 hover:text-violet-400 transition-colors text-left"
            >
              {prompt.promptText}
            </button>
          </div>
          <p className="text-xs text-zinc-600 mt-0.5">
            {prompt.lastCheckedAt
              ? `Last checked ${new Date(prompt.lastCheckedAt).toLocaleString()}`
              : running ? 'Check queued…' : 'Never checked'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1">
          <button
            onClick={onRunCheck}
            disabled={running || pendingResults}
            title={running || pendingResults ? 'Check in progress…' : 'Run check now'}
            className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-40 transition-colors"
          >
            {(running || pendingResults) ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              /* Refresh/re-run icon — distinct from the Resume ▶ button */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            )}
          </button>
          <button
            onClick={onToggle}
            title={prompt.isActive ? 'Pause' : 'Resume'}
            className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 transition-colors"
          >
            {prompt.isActive ? (
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
            onClick={onDelete}
            title="Delete"
            className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 3h6l1 1h4v2H4V4h4L9 3zm-4 5h14l-1 13H6L5 8zm5 2v9h1v-9H10zm3 0v9h1v-9h-1z"/>
            </svg>
          </button>
          </div>
          <p className="text-[10px] text-zinc-600">
            Next run: {(() => {
              const now = new Date();
              const next = new Date();
              next.setUTCHours(scheduleHour, 0, 0, 0);
              if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
              const isToday = next.toDateString() === now.toDateString();
              return `${isToday ? 'today' : 'tomorrow'} ${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            })()}
          </p>
        </div>
      </div>

      {/* Visibility Score — primary metric for the prompt */}
      <div className="border-t border-zinc-800 px-4 py-3 flex items-center gap-4">
        <div className="shrink-0">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium mb-0.5">Visibility Score</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tabular-nums ${
              prompt.latestVisibilityPct == null ? 'text-zinc-600'
              : prompt.latestVisibilityPct >= 60 ? 'text-green-400'
              : prompt.latestVisibilityPct >= 30 ? 'text-yellow-400'
              : 'text-red-400'
            }`}>
              {prompt.latestVisibilityPct != null ? `${prompt.latestVisibilityPct}%` : '—'}
            </span>
            {(() => {
              const total = (prompt.engineStats ?? []).reduce((s, e) => s + e.checks, 0);
              const mentioned = total > 0 && prompt.latestVisibilityPct != null
                ? Math.round(prompt.latestVisibilityPct / 100 * total)
                : null;
              return total > 0 ? (
                <span className="text-xs text-zinc-500">{mentioned} of {total} AI responses</span>
              ) : (
                <span className="text-xs text-zinc-600">No checks yet</span>
              );
            })()}
          </div>
        </div>
        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              !prompt.latestVisibilityPct ? 'bg-zinc-700'
              : prompt.latestVisibilityPct >= 60 ? 'bg-green-500'
              : prompt.latestVisibilityPct >= 30 ? 'bg-yellow-500'
              : 'bg-red-500'
            }`}
            style={{ width: `${prompt.latestVisibilityPct ?? 0}%` }}
          />
        </div>
      </div>

      {/* Per-engine breakdown: Position + Sentiment only */}
      <div className="border-t border-zinc-800">
        {/* Pending results banner */}
        {pendingResults && (
          <div className="mx-4 mt-2 flex items-center gap-2 rounded bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 text-xs text-indigo-300">
            <svg className="animate-spin shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            Check running — results appear automatically in ~1 minute
          </div>
        )}
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/80">
            <tr>
              <th className="px-4 py-2 text-left text-[10px] uppercase text-zinc-600 font-medium">Engine</th>
              <th className="px-4 py-2 text-left text-[10px] uppercase text-zinc-600 font-medium">
                Position
                <InfoTooltip text="Where your brand appears in the AI’s answer. Position 1 = first recommendation (best). Detected from numbered lists (1. Bank A  2. Mashreq  3. ...). Lower is better." />
              </th>
              <th className="px-4 py-2 text-left text-[10px] uppercase text-zinc-600 font-medium">
                Sentiment
                <InfoTooltip text="Tone of the AI’s response when your brand is mentioned. ↑ Positive — favorable language (best, top, leading, recommended) → Neutral — no strong positive or negative framing ↓ Negative — unfavorable language (avoid, poor, limited). Hover over any badge for details." />
              </th>
              <th className="px-4 py-2 text-left text-[10px] uppercase text-zinc-600 font-medium">Last Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {(prompt.engineStats ?? []).map((es) => (
              <EngineStatsRow
                key={es.engine}
                stats={es}
                onViewResponse={
                  es.latestResponseText
                    ? () => setActiveResponse({ engine: es.engine, text: es.latestResponseText! })
                    : undefined
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Response Modal */}
      {activeResponse && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActiveResponse(null)}>
          <div
            className="w-full max-w-2xl max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <EngineBadge engine={activeResponse.engine} />
                <span className="text-sm text-zinc-400">Latest response</span>
              </div>
              <button
                onClick={() => setActiveResponse(null)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {activeResponse.text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Engine Stats Row ─────────────────────────────────────────

function EngineStatsRow({ stats, onViewResponse }: { stats: EngineStats; onViewResponse?: () => void }) {
  const hasData = stats.checks > 0;
  const pos = hasData && stats.avgPosition != null ? stats.avgPosition : null;
  const posColor = pos == null ? '' : pos <= 3 ? 'text-green-400' : pos <= 6 ? 'text-yellow-400' : 'text-red-400';

  return (
    <tr
      className={`hover:bg-zinc-800/20 ${onViewResponse ? 'cursor-pointer' : ''}`}
      onClick={onViewResponse}
      title={onViewResponse ? 'Click to view AI response' : undefined}
    >
      <td className="px-4 py-2.5">
        <EngineBadge engine={stats.engine} />
      </td>
      <td className="px-4 py-2.5">
        {pos != null ? (
          <span className={`font-semibold tabular-nums ${posColor}`}>#{pos}</span>
        ) : (
          <span className="text-zinc-600">{hasData ? 'Not in list' : '—'}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {hasData ? <SentimentBadge sentiment={stats.latestSentiment} /> : <span className="text-zinc-600">—</span>}
      </td>
      <td className="px-4 py-2.5 text-zinc-600">
        <div className="flex items-center gap-2">
          {stats.lastCheckedAt ? new Date(stats.lastCheckedAt).toLocaleDateString() : '—'}
          {onViewResponse && (
            <svg className="shrink-0 text-zinc-500 hover:text-indigo-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </div>
      </td>
    </tr>
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

function InfoIcon({ tip }: { tip: string }) {
  return (
    <span
      title={tip}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-zinc-600 text-zinc-600 hover:border-zinc-400 hover:text-zinc-400 cursor-default text-[9px] font-bold leading-none select-none shrink-0"
    >
      ?
    </span>
  );
}

function OverviewCard({ overview }: { overview: VisibilityOverview }) {
  const scoreColor = overview.overallScore >= 60 ? 'text-green-400' : overview.overallScore >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
      <div className="flex items-center gap-8">
        <div className="text-center">
          <div className={`text-4xl font-bold ${scoreColor}`}>{overview.overallScore}</div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className="text-xs text-zinc-500">Visibility Score</div>
            <InfoIcon tip="Weighted composite out of 100. 60% weight on mention rate + 40% weight on position score (position 1 = 100, 2 = 80 … 6+ = 0). Based on the last 30 days across all prompts." />
          </div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-4">
          <div>
            <div className="text-lg font-semibold text-zinc-100">{overview.avgVisibilityPct}%</div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="text-xs text-zinc-500">Mention Rate</div>
              <InfoIcon tip="% of AI checks (across all prompts &amp; engines) where your brand was detected in the response. Last 30 days." />
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              {overview.avgPosition ? `#${overview.avgPosition}` : '-'}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="text-xs text-zinc-500">Avg Position</div>
              <InfoIcon tip="Average rank of your brand in AI responses where it was mentioned. #1 means listed first. Lower is better. Last 30 days." />
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">{overview.activePrompts}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="text-xs text-zinc-500">Active Prompts</div>
              <InfoIcon tip="Number of prompts currently enabled for scheduled checks. Paused prompts are excluded from all metrics." />
            </div>
          </div>
        </div>
      </div>

      {/* Engine breakdown */}
      {overview.byEngine.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-1 mb-2">
            <div className="text-xs font-medium text-zinc-500">Visibility by Engine</div>
            <InfoIcon tip="Per-engine mention rate: how often your brand appeared in that engine's responses over the last 30 days." />
          </div>
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
